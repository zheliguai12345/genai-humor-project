import assert from 'node:assert/strict';
import test from 'node:test';
const origin=process.env.AUTH_TEST_ORIGIN??'http://localhost:3001';
test('legacy caption rating now redirects to public Discover without altering its tables',async()=>{
  const response=await fetch(origin+'/rate',{redirect:'manual'});
  assert.equal(response.status,307);
  assert.equal(new URL(response.headers.get('location'),origin).pathname,'/');
});
