#!/usr/bin/env python3
"""Independent, streaming technical QA. No generative judgement is fabricated."""
import hashlib,json,math,pathlib,re,subprocess,sys
from fractions import Fraction

def run(args):
 r=subprocess.run(args,capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr[-2000:])
 return r

def inspect(video,timeline,out,profile):
 out.mkdir(parents=True,exist_ok=True)
 meta=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]).stdout)
 plan=json.loads(timeline.read_text());v=next((s for s in meta['streams'] if s['codec_type']=='video'),{});a=next((s for s in meta['streams'] if s['codec_type']=='audio'),{})
 width=1080 if profile=='final' else 540;duration=float(meta['format']['duration']);words=plan['words'];checks={}
 checks.update(video_stream=bool(v),audio_stream=bool(a),h264=v.get('codec_name')=='h264',aac=a.get('codec_name')=='aac',resolution=(v.get('width'),v.get('height'))==(width,width*16//9),fps=abs(float(Fraction(v.get('avg_frame_rate','0')))-30)<0.001,duration_matches=abs(duration-plan['duration'])<0.08)
 checks['scene_coverage']=all(abs(s['start']-(plan['scenes'][i-1]['end'] if i else 0))<1/30 for i,s in enumerate(plan['scenes'])) and abs(plan['scenes'][-1]['end']-plan['duration'])<1/30
 checks['caption_intervals']=bool(words) and all(0<=w['start']<w['end']<=duration+.05 and (i==0 or w['start']>=words[i-1]['end']-.001) for i,w in enumerate(words))
 layouts=plan.get('layoutReports',[])
 checks['caption_safe_zone']=len(layouts)==len(plan['scenes']) and all(l['captionsSafe'] and l['maxCaptionWidth']<=790 and l['frames']==s['frames'] for l,s in zip(layouts,plan['scenes']))
 # Verify the deterministic renderer's computed text width separately in Native rendering; final sheets still need inspection.
 checks['characters_in_frame']=bool(layouts) and all(l.get('actorsSafe',False) for l in layouts)
 checks['props_in_frame']=bool(layouts) and all(l.get('propsSafe',False) for l in layouts)
 checks['narration_coverage']=all(any(s['start']<=w['start']<s['end'] for w in words) for s in plan['scenes'])
 audio=run(['ffmpeg','-hide_banner','-nostats','-i',str(video),'-vn','-af','volumedetect,ebur128=peak=true,silencedetect=n=-45dB:d=0.6','-f','null','-']).stderr
 (out/'audio.log').write_text(audio)
 peak=re.search(r'max_volume: ([-\d.]+) dB',audio);mean=re.search(r'mean_volume: ([-\d.]+) dB',audio)
 peak=float(peak.group(1)) if peak else None;mean=float(mean.group(1)) if mean else None
 checks['audio_not_clipped']=peak is not None and peak<=-0.5;checks['audio_not_silent']=mean is not None and mean>-38
 silences=[float(x) for x in re.findall(r'silence_duration: ([\d.]+)',audio)];checks['no_long_silence']=not any(x>1.4 for x in silences)
 # All frames decoded, sampled spatially, in bounded memory. Avoid loading a full movie into RAM.
 w,h=96,170;size=w*h
 proc=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-fps_mode','passthrough','-an','-vf',f'scale={w}:{h}:flags=area','-pix_fmt','gray','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 black=[];blank=[];frozen=[];count=0;previous=None;still_start=None
 while True:
  buf=bytearray()
  while len(buf)<size:
   part=proc.stdout.read(size-len(buf))
   if not part:break
   buf.extend(part)
  if not buf:break
  if len(buf)!=size:raise RuntimeError('Fotograma incompleto')
  avg=sum(buf)/size;variance=sum((n-avg)**2 for n in buf)/size
  if avg<6:black.append(count)
  if variance<0.7:blank.append(count)
  if previous is not None:
   diff=sum(abs(x-y) for x,y in zip(buf,previous))/size
   if diff<.015:still_start=count-1 if still_start is None else still_start
   else:
    if still_start is not None and count-still_start>=15:frozen.append([still_start,count])
    still_start=None
  previous=buf;count+=1
 if still_start is not None and count-still_start>=15:frozen.append([still_start,count])
 err=proc.stderr.read().decode();rc=proc.wait()
 (out/'frame-decode.log').write_text(err)
 if rc!=0:raise RuntimeError('Falló decodificación de fotogramas: '+err[-2000:])
 checks['decode_all_frames']=rc==0 and count==plan['frames'];checks['no_black_frames']=not black;checks['no_blank_frames']=not blank;checks['no_frozen_spans']=not frozen
 # Twelve review samples distributed across the entire output, with timestamps burned into sheets only.
 step=max(duration/12,1/30)
 run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f'fps=1/{step},scale=270:480,tile=4x3','-frames:v','1','-update','1',str(out/'contact.png')])
 for i,scene in enumerate(plan['scenes']):
  at=(scene['start']+scene['end'])/2
  run(['ffmpeg','-v','error','-y','-ss',str(at),'-i',str(video),'-frames:v','1','-update','1',str(out/f'scene-{i+1:02d}.png')])
 sha=hashlib.sha256(video.read_bytes()).hexdigest()
 result={'videoSHA256':sha,'file':str(video),'duration':duration,'framesDecoded':count,'width':v.get('width'),'height':v.get('height'),'peakDBFS':peak,'meanDBFS':mean,'blackFrames':black[:50],'blankFrames':blank[:50],'frozenSpans':frozen,'checks':checks,'technicalPassed':all(checks.values()),'visualReview':'PENDING: inspect contact.png and every scene PNG','creativeReview':'PENDING: listen to narration and inspect story, sources, continuity and pacing','limitations':['Spatial blank/freeze analysis uses 96x170 samples; tiny defects require visual inspection.','Caption positioning is a deterministic layout invariant; optical clipping and semantic collisions require visual review.','Speech timings come from audio analysis when provider markers are unavailable; inspect actual synchronization.']}
 (out/'report.json').write_text(json.dumps(result,indent=2)+'\n');(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
 print(json.dumps(result,indent=2));return result['technicalPassed']

if __name__=='__main__':
 try:ok=inspect(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),sys.argv[4]);sys.exit(0 if ok else 1)
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(2)
