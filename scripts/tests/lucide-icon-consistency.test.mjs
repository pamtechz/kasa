import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const read=(p)=>readFileSync(join(root,p),'utf8');
function uiFiles(dir){
 return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  const next=dir+'/'+entry.name;
  if(entry.isDirectory())return uiFiles(next);
  return /\.(tsx|jsx)$/.test(entry.name)?[next]:[];
 });
}

test('every source-authored interface symbol uses an icon component rather than an emoji glyph',()=>{
 const paths=[...uiFiles('src/components'),...uiFiles('src/app')];
 for(const path of paths){
  const content=read(path).replaceAll('©','');
  assert.doesNotMatch(content,/\p{Extended_Pictographic}/u,path+' contains an emoji-based UI icon');
 }
 assert.doesNotMatch(read('src/app/api/agent/leaderboard/route.ts'),/badgeEmoji|[💎🥇🥈🥉]/u);
});
test('home header sign-in link is independent of the agent recruitment form status',()=>{
 const links=read('src/components/PublicApplicationLinks.tsx');
 const home=read('src/app/page.tsx');
 assert.match(home,/<PublicApplicationLinks placement="nav"\/>/);
 assert.match(links,/if\(placement==='nav'\)return <Link className="nav-primary" href="\/login">Sign in <LogIn/);
 assert.match(links,/if\(placement==='nav'\)return;/);
 assert.doesNotMatch(links,/Become an agent/);
 assert.match(links,/Apply to be an agent/);
});
test('hero tags, pinned badges and agent rankings render typed Lucide icons',()=>{
 const hero=read('src/components/HeroSlider.tsx');
 const pinned=read('src/components/PublicPages.tsx');
 const agent=read('src/app/(portal)/agent-portal/page.tsx');
 const css=read('src/app/globals.css');
 assert.match(hero,/icon\?: LucideIcon/);
 assert.match(hero,/const Icon = tag\.icon/);
 assert.match(hero,/<Icon size=\{16\}/);
 assert.doesNotMatch(hero,/tag-emoji/);
 assert.match(pinned,/<Pin size=\{13\}/);
 assert.match(agent,/<TierIcon size=\{19\}/);
 assert.match(agent,/Medal, Gem/);
 assert.match(css,/\.tag-icon\{/);
 assert.match(css,/\.agent-tier-diamond/);
});
