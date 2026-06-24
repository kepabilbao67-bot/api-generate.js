/**
 * API Playground - Interactive testing of any generated API
 * GET /api/v1/playground/:slug - Returns interactive playground HTML
 */

import { Router } from 'express';
import db from '../utils/database.js';
import { config } from '../config/index.js';

const router = Router();

router.get('/:slug', (req, res) => {
  const api = db.prepare("SELECT * FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const schema = JSON.parse(api.schema_definition);
  const baseUrl = `${config.baseUrl}/api/v1/live/${api.slug}`;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${api.name} - API Playground</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#6366f1;--bg:#0f172a;--card:#1e293b;--text:#f8fafc;--muted:#94a3b8;--border:#334155;--success:#10b981;--danger:#ef4444}
body{font-family:-apple-system,sans-serif;background:var(--bg);color:var(--text);padding:24px}
.container{max-width:1000px;margin:0 auto}
h1{margin-bottom:8px}
.subtitle{color:var(--muted);margin-bottom:24px}
.key-input{display:flex;gap:8px;margin-bottom:24px}
.key-input input{flex:1;padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-family:monospace}
.endpoints{display:grid;gap:12px;margin-bottom:24px}
.endpoint{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;cursor:pointer}
.endpoint:hover{border-color:var(--primary)}
.endpoint .method{font-weight:700;font-size:0.8rem;padding:2px 8px;border-radius:4px;margin-right:8px}
.GET{background:#61affe22;color:#61affe}.POST{background:#49cc9022;color:#49cc90}
.PUT{background:#fca13022;color:#fca130}.DELETE{background:#f93e3e22;color:#f93e3e}
.result{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-top:16px;display:none}
.result pre{white-space:pre-wrap;font-family:monospace;font-size:0.85rem;max-height:400px;overflow-y:auto}
.result .status{font-weight:700;margin-bottom:8px}
.result .status.ok{color:var(--success)}.result .status.err{color:var(--danger)}
textarea{width:100%;min-height:80px;padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:monospace;margin:8px 0;resize:vertical}
button{padding:8px 16px;border-radius:6px;border:none;background:var(--primary);color:white;font-weight:600;cursor:pointer}
</style></head><body>
<div class="container">
<h1>${api.name} - Playground</h1>
<p class="subtitle">Base URL: <code>${baseUrl}</code></p>
<div class="key-input">
<input type="text" id="apiKey" placeholder="Enter your API Key (X-API-Key)">
</div>
<div class="endpoints" id="endpoints"></div>
<div class="result" id="result">
<div class="status" id="status"></div>
<pre id="response"></pre>
</div>
</div>
<script>
const BASE='${baseUrl}';
const schema=${JSON.stringify(schema)};
const endpoints=document.getElementById('endpoints');
schema.resources.forEach(r=>{
  const name=r.name.toLowerCase();
  const plural=name.endsWith('s')?name:name+'s';
  const methods=[
    {m:'GET',path:'/'+plural,desc:'List all '+plural},
    {m:'POST',path:'/'+plural,desc:'Create '+name,body:true},
    {m:'GET',path:'/'+plural+'/:id',desc:'Get '+name+' by ID'},
    {m:'PUT',path:'/'+plural+'/:id',desc:'Update '+name,body:true},
    {m:'DELETE',path:'/'+plural+'/:id',desc:'Delete '+name},
  ];
  methods.forEach(ep=>{
    const div=document.createElement('div');
    div.className='endpoint';
    div.innerHTML='<span class="method '+ep.m+'">'+ep.m+'</span><span>'+ep.path+' — '+ep.desc+'</span>'+(ep.body?'<textarea placeholder="JSON body (optional)"></textarea>':'')+'<br><button onclick="exec(this,\\''+ep.m+'\\',\\''+ep.path+'\\')">Send</button>';
    endpoints.appendChild(div);
  });
});
async function exec(btn,method,path){
  const key=document.getElementById('apiKey').value;
  if(!key){alert('Enter API key first');return;}
  let realPath=path;
  if(path.includes(':id')){
    const id=prompt('Enter ID:');
    if(!id)return;
    realPath=path.replace(':id',id);
  }
  const textarea=btn.parentElement.querySelector('textarea');
  const body=textarea?textarea.value:null;
  try{
    const r=await fetch(BASE+realPath,{
      method,
      headers:{'X-API-Key':key,'Content-Type':'application/json'},
      ...(body&&{body}),
    });
    const data=await r.json();
    const result=document.getElementById('result');
    result.style.display='block';
    document.getElementById('status').className='status '+(r.ok?'ok':'err');
    document.getElementById('status').textContent=r.status+' '+(r.ok?'OK':'Error');
    document.getElementById('response').textContent=JSON.stringify(data,null,2);
  }catch(e){
    document.getElementById('result').style.display='block';
    document.getElementById('status').className='status err';
    document.getElementById('status').textContent='Error';
    document.getElementById('response').textContent=e.message;
  }
}
</script></body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
