import fs from 'node:fs';
const pages=JSON.parse(fs.readFileSync('src/page-metadata.json','utf8'));
const base='https://mohamedkbany.vercel.app';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const shell=fs.readFileSync('dist/index.html','utf8').replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta name="description"[^>]*>/,'');
fs.mkdirSync('dist/share-shells',{recursive:true});
for(const page of pages){const t=escape(page.title),d=escape(page.description),url=base+page.path;const tags=`<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Mohamed Kbany" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${base}/portfolio-share-v1.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Mohamed Kbany, Video Editing, AI Films and Motion Graphics" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${base}/portfolio-share-v1.jpg" />`;
const html=shell.replace('</head>',tags+'\n</head>');
const path=page.path==='/'?'dist/index.html':'dist/share-shells/'+page.path.slice(1).replaceAll('/','-')+'.html';
fs.writeFileSync(path,html);console.log(page.path+' -> '+path);}
