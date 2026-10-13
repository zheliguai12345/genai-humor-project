import assert from 'node:assert/strict';
import test from 'node:test';
import * as jsx from 'react/jsx-runtime';
import { moduleLoader } from './helpers/module-loader.mjs';

function nodes(element,result=[]) {
  if(!element||typeof element!=='object')return result;
  if(Array.isArray(element)){element.forEach(item=>nodes(item,result));return result;}
  result.push(element);nodes(element.props?.children,result);return result;
}
async function list({confirmed=true,failure=false}={}) {
  const slots=[],tasks=[],confirmations=[],calls=[];let cursor=0;
  const journeys=[{id:'draft',title:'Draft day',status:'draft',is_editorial:false},
    {id:'published',title:'Public day',status:'published',is_editorial:false},
    {id:'seed',title:'Editorial',status:'published',is_editorial:true}];
  const react={useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},
    useRef(initial){const index=cursor++;return slots[index]??={current:initial};},useTransition(){cursor++;return [false,task=>tasks.push(task())];}};
  const {YourJourneys}=await moduleLoader('app/profile/your-journeys.tsx',{'react/jsx-runtime':jsx,react,
    window:{confirm:message=>{confirmations.push(message);return confirmed;}},
    'next/navigation':{useRouter:()=>({refresh(){}})},
    '../components/journey-card':{JourneyCard:()=>null},
    '@/app/journey-actions':{deleteJourney:async id=>{calls.push(id);return failure?{error:'Not allowed'}:{data:{id}};}},
  });
  const render=()=>{cursor=0;return nodes(YourJourneys({journeys}));};
  return {render,confirmations,calls,tasks,click:id=>render().find(n=>n.type==='button'&&n.props['aria-label']==='Delete '+journeys.find(j=>j.id===id).title).props.onClick()};
}
test('Profile deletion requires confirmation, warns about published votes, and updates the list/status',async()=>{
  for(const id of ['draft','published']) {
    const view=await list();view.click(id);await view.tasks[0];
    assert.equal(view.confirmations[0],"Delete this journey? This can't be undone."+(id==='published'?'\nIts votes will be removed too.':''));
    assert.deepEqual(view.calls,[id]);
    assert.ok(view.render().some(n=>n.props?.role==='status'&&n.props.children==='Journey deleted'));
    assert.ok(!view.render().some(n=>n.props?.journey?.id===id));
    assert.ok(!view.render().some(n=>n.type==='button'&&n.props['aria-label']==='Delete Editorial'));
  }
});
test('cancelled confirmation makes no request, and a failed deletion keeps the card with an alert',async()=>{
  const cancelled=await list({confirmed:false});cancelled.click('draft');assert.equal(cancelled.calls.length,0);
  const failed=await list({failure:true});failed.click('published');await failed.tasks[0];
  assert.ok(failed.render().some(n=>n.props?.journey?.id==='published'));
  assert.ok(failed.render().some(n=>n.props?.role==='alert'));
});
test('successful delete action invalidates Profile and public/private Journey routes',async()=>{
  const paths=[],calls=[];
  const api=await moduleLoader('app/journey-actions.ts',{'next/cache':{revalidatePath:path=>paths.push(path)},
    '@/utils/supabase/journeys':{generateJourney(){},getGenerationQuota(){},publishJourney(){},voteOnJourney(){},deleteOwnJourney:async id=>{calls.push(id);return {id};}}});
  assert.deepEqual(JSON.parse(JSON.stringify(await api.deleteJourney('isolated'))),{data:{id:'isolated'}});
  assert.deepEqual(calls,['isolated']);
  assert.deepEqual(paths,['/profile','/','/discover','/journeys/isolated','/preview/isolated']);
});
