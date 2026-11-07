// Local candidate harness helper; no Zuri producer or authentication implementation.
export function selectContextVector(bundle,businessId,selected='AUTO'){
 if(selected!=='AUTO')return bundle.vectors.find(v=>v.id===selected);
 return bundle.vectors.find(v=>v.origin==='source-rule-candidate'&&v.request.businessId===businessId&&v.expect.accept&&v.upstream.status===200);
}
export function contextVectorResponse(vector){
 if(!vector)return Response.json({error:{code:'CONTEXT_UNAVAILABLE'}},{status:403});
 if(vector.wire){const chunks=vector.wire.chunks.map(x=>Uint8Array.from(Buffer.from(x,'base64')));return new Response(new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(chunk);c.close();}}),{status:vector.upstream.status,headers:{'content-type':'application/json','cache-control':'no-store'}});}
 return Response.json(vector.upstream.body??{}, {status:vector.upstream.status,headers:{'cache-control':'no-store'}});
}
