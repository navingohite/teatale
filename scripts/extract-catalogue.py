import sys,zipfile,xml.etree.ElementTree as E,json,re,pathlib
from PIL import Image,ImageOps,ImageDraw
root=pathlib.Path(__file__).resolve().parent.parent
z=zipfile.ZipFile(sys.argv[1] if len(sys.argv)>1 else '/Users/navingohite/Downloads/Tea_Tale_Catalogue.docx');ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
rels={e.attrib['Id']:e.attrib['Target'] for e in E.fromstring(z.read('word/_rels/document.xml.rels'))}
products=[]; current=None; raw=[]
for el in E.fromstring(z.read('word/document.xml')).find('w:body',ns):
 t=' '.join(e.text or '' for e in el.findall('.//w:t',ns));raw.append(t)
 m=re.match(r'^(\d+)\.\s+(.+)',t)
 if m:
  current={'position':int(m[1]),'name':m[2],'slug':re.sub('[^a-z0-9]+','-',m[2].lower()).strip('-')};products.append(current)
 elif current and 'ABOUT   ' in t:
  labels=['PACK','ABOUT','ORIGIN & HISTORY','TYPE & INFUSION','TASTE & AROMA','BENEFITS','HOW TO BREW','CAFFEINE','PLEASE NOTE']
  matches=list(re.finditer(r'('+'|'.join(re.escape(x) for x in labels)+r')\s+',t))
  current['sourceFields']={m[1]:t[m.end():matches[i+1].start() if i+1<len(matches) else len(t)].strip() for i,m in enumerate(matches)}
  rid=el.find('.//a:blip',ns).attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'];target=rels[rid];blob=z.read('word/'+target)
  (root/'assets/originals'/pathlib.Path(target).name).write_bytes(blob)
  im=Image.open(root/'assets/originals'/pathlib.Path(target).name).convert('RGB')
  for w in [480,960]:
   cp=im.copy();cp.thumbnail((w,w*2));cp.save(root/f'assets/review/{current["slug"]}-{w}.webp',quality=85);cp.save(root/f'public/teas/{current["slug"]}-poster-{w}.webp',quality=85)
  w,h=im.size
  label=im.crop((int(w*.085),int(h*.395),int(w*.93),int(h*.525)))
  label.save(root/f'public/teas/{current["slug"]}-label.webp',quality=90)
  for width in [480,960]:
   cp=label.copy();cp.thumbnail((width,width));cp.save(root/f'public/teas/{current["slug"]}-label-{width}.webp',quality=85)
  current['sourceImage']=target;current['image']=f'/teas/{current["slug"]}-960.webp';current['alt']=current['name']+' — Tea Tale catalogue product image'
 elif current and not current.get('summary'):
  current['summary']=t
(root/'data/catalogue-source.json').write_text(json.dumps(products,indent=2,ensure_ascii=False))
(root/'docs/catalogue-transcript.txt').write_text('\n\n'.join(raw).rstrip()+'\n')
sheet=Image.new('RGB',(1000,1200),'white');d=ImageDraw.Draw(sheet)
for i,p in enumerate(products):
 im=Image.open(root/'assets/review'/pathlib.Path(p['image']).name);im.thumbnail((230,260));x=(i%4)*250;y=(i//4)*300;sheet.paste(im,(x+(250-im.width)//2,y));d.text((x+5,y+265),str(i+1)+'. '+p['name'][:31],fill='black')
sheet.save(root/'docs/catalogue-contact-sheet.jpg')
print('Extracted',len(products),'products')
