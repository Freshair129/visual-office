import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceRoute,workspaceHash} from '../web/workspace-navigation.js';
test('workspace links preserve work and result provenance and legacy hashes',()=>{
 assert.deepEqual(workspaceRoute('#jobs'),{view:'work',id:null});
 assert.deepEqual(workspaceRoute('#activity'),{view:'inbox',id:null});
 assert.deepEqual(workspaceRoute(workspaceHash('results','work-id/kai')),{view:'results',id:'work-id/kai'});
 assert.equal(workspaceRoute('#unknown').view,'office');
 assert.equal(workspaceRoute('#chat/%').id,null);
});
