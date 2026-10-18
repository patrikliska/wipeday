import fs from 'node:fs';
const K = /^RETRO_DIFFUSION_API_KEY=(.+)$/m.exec(fs.readFileSync(new URL('../../../.env', import.meta.url),'utf8'))[1].trim();
const H = { 'X-RD-Token': K, 'Content-Type': 'application/json' };
const img = fs.readFileSync('survivor_32x48.png').toString('base64');
const mk = (style, extra={}) => ({ prompt: 'a lone island survivor in a worn green jacket with a backpack, holding a wrench, breathing calmly and shifting weight', prompt_style: style, width: 32, height: 48, num_images: 1, input_image: img, frames_duration: 8, return_spritesheet: true, remove_bg: true, ...extra });
const mode = process.argv[2];
if (mode === 'estimate') {
  for (const st of ['rd_advanced_animation__idle','rd_advanced_animation__walking','rd_advanced_animation__subtle_motion']) {
    const r = await (await fetch('https://api.retrodiffusion.ai/v2/inferences',{method:'POST',headers:H,body:JSON.stringify({...mk(st),check_cost:true})})).json();
    console.log(st, JSON.stringify(r).slice(0,160));
  }
} else if (mode === 'submit') {
  for (const st of process.argv.slice(3)) {
    const r = await (await fetch('https://api.retrodiffusion.ai/v2/inferences',{method:'POST',headers:H,body:JSON.stringify(mk(st))})).json();
    console.log(st, JSON.stringify(r).slice(0,200)); fs.appendFileSync('anim_tasks.txt', `${st} ${r.task_id}\n`);
  }
} else {
  const lines = fs.readFileSync('anim_tasks.txt','utf8').trim().split('\n').map(l=>l.split(' '));
  for (const [st,id] of lines) {
    const t = await (await fetch(`https://api.retrodiffusion.ai/v2/inferences/tasks/${id}`,{headers:H})).json();
    console.log(st, t.status);
    if (t.status === 'succeeded') {
      const r = t.result; fs.writeFileSync(`${st}.json`, JSON.stringify({...r, base64_images: undefined, base64_gif: undefined}, null, 1));
      (r.base64_images||[]).forEach((b,i)=>fs.writeFileSync(`${st}_${i}.png`, Buffer.from(b,'base64')));
      for (const k of Object.keys(r)) if (/gif|sheet|anim/i.test(k) && typeof r[k]==='string' && r[k].length>100) fs.writeFileSync(`${st}_${k}.bin`, Buffer.from(r[k],'base64'));
      console.log('  keys', Object.keys(r).join(','), 'cost', r.balance_cost, 'images', (r.base64_images||[]).length);
    } else if (t.status === 'failed') console.log('  ', JSON.stringify(t).slice(0,300));
  }
}
