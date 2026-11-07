import * as THREE from 'three';

const directionalShadowCall='directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const maskDirectionalCall='shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const combinedReceiverMaterials=new WeakMap();

const combinedShadowFunction=`
#ifdef USE_SHADOWMAP
#if NUM_DIR_LIGHT_SHADOWS > 1
float hybridTexture2DCompare( sampler2D staticMap, sampler2D actorMap, vec2 uv, float compare ) {
	return min( texture2DCompare( staticMap, uv, compare ), texture2DCompare( actorMap, uv, compare ) );
}

float getHybridCombinedShadow( sampler2D staticMap, DirectionalLightShadow staticLight, vec4 shadowCoord, sampler2D actorMap, DirectionalLightShadow actorLight ) {
	float shadow = 1.0;
	shadowCoord.xyz /= shadowCoord.w;
	shadowCoord.z += staticLight.shadowBias;
	bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
	if ( inFrustum && shadowCoord.z <= 1.0 ) {
	#if defined( SHADOWMAP_TYPE_PCF )
		vec2 texelSize = vec2( 1.0 ) / staticLight.shadowMapSize;
		float dx0 = - texelSize.x * staticLight.shadowRadius;
		float dy0 = - texelSize.y * staticLight.shadowRadius;
		float dx1 = + texelSize.x * staticLight.shadowRadius;
		float dy1 = + texelSize.y * staticLight.shadowRadius;
		float dx2 = dx0 / 2.0;
		float dy2 = dy0 / 2.0;
		float dx3 = dx1 / 2.0;
		float dy3 = dy1 / 2.0;
		shadow = (
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy, shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
		) * ( 1.0 / 17.0 );
	#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
		vec2 texelSize = vec2( 1.0 ) / staticLight.shadowMapSize;
		float dx = texelSize.x;
		float dy = texelSize.y;
		vec2 uv = shadowCoord.xy;
		vec2 f = fract( uv * staticLight.shadowMapSize + 0.5 );
		uv -= f * texelSize;
		shadow = (
			hybridTexture2DCompare( staticMap, actorMap, uv, shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
			hybridTexture2DCompare( staticMap, actorMap, uv + texelSize, shadowCoord.z ) +
			mix( hybridTexture2DCompare( staticMap, actorMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ), hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ), f.x ) +
			mix( hybridTexture2DCompare( staticMap, actorMap, uv + vec2( -dx, dy ), shadowCoord.z ), hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ), f.x ) +
			mix( hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 0.0, -dy ), shadowCoord.z ), hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ), f.y ) +
			mix( hybridTexture2DCompare( staticMap, actorMap, uv + vec2( dx, -dy ), shadowCoord.z ), hybridTexture2DCompare( staticMap, actorMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ), f.y ) +
			mix( mix( hybridTexture2DCompare( staticMap, actorMap, uv + vec2( -dx, -dy ), shadowCoord.z ), hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ), f.x ), mix( hybridTexture2DCompare( staticMap, actorMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ), hybridTexture2DCompare( staticMap, actorMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ), f.x ), f.y )
		) * ( 1.0 / 9.0 );
	#elif defined( SHADOWMAP_TYPE_VSM )
		shadow = min( VSMShadow( staticMap, shadowCoord.xy, shadowCoord.z ), VSMShadow( actorMap, shadowCoord.xy, shadowCoord.z ) );
	#else
		shadow = hybridTexture2DCompare( staticMap, actorMap, shadowCoord.xy, shadowCoord.z );
	#endif
	}
	return mix( 1.0, shadow, staticLight.shadowIntensity );
}
#endif
#endif
`;

function shadowMaskChunk(){
  return THREE.ShaderChunk.shadowmask_pars_fragment.replace(maskDirectionalCall,`
#if NUM_DIR_LIGHT_SHADOWS > 1
		if ( UNROLLED_LOOP_INDEX == 0 ) {
			shadow *= receiveShadow ? getHybridCombinedShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ], vDirectionalShadowCoord[ 0 ], directionalShadowMap[ 1 ], directionalLightShadows[ 1 ] ) : 1.0;
		} else if ( UNROLLED_LOOP_INDEX > 1 ) {
			${maskDirectionalCall}
		}
#else
		${maskDirectionalCall}
#endif`);
}

function lightsFragmentChunk(){
  return THREE.ShaderChunk.lights_fragment_begin.replace(directionalShadowCall,`
#if NUM_DIR_LIGHT_SHADOWS > 1
		if ( UNROLLED_LOOP_INDEX == 0 ) {
			directLight.color *= ( directLight.visible && receiveShadow ) ? getHybridCombinedShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ], vDirectionalShadowCoord[ 0 ], directionalShadowMap[ 1 ], directionalLightShadows[ 1 ] ) : 1.0;
		} else if ( UNROLLED_LOOP_INDEX > 1 ) {
			${directionalShadowCall}
		}
#else
		${directionalShadowCall}
#endif`);
}

export function setHybridCombinedShadowReceiver(material,enabled=true){
  if(!material)return false;
  const original=combinedReceiverMaterials.get(material);
  if(!enabled){
    if(!original)return false;
    material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;
    if(original.hadFlag)material.userData.hybridCombinedShadowReceiver=original.flag;else delete material.userData.hybridCombinedShadowReceiver;
    combinedReceiverMaterials.delete(material);material.needsUpdate=true;return true;
  }
  if(original||!(material.isShadowMaterial||material.isMeshStandardMaterial||material.isMeshPhongMaterial||material.isMeshLambertMaterial||material.isMeshToonMaterial))return false;
  const originalCompile=material.onBeforeCompile,originalKey=material.customProgramCacheKey,hadFlag=Object.prototype.hasOwnProperty.call(material.userData,'hybridCombinedShadowReceiver'),flag=material.userData.hybridCombinedShadowReceiver;
  combinedReceiverMaterials.set(material,{onBeforeCompile:originalCompile,customProgramCacheKey:material.customProgramCacheKey,hadFlag,flag});
  material.onBeforeCompile=function(shader,renderer){
    originalCompile.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>',`${THREE.ShaderChunk.shadowmap_pars_fragment}\n${combinedShadowFunction}`)
      .replace('#include <shadowmask_pars_fragment>',shadowMaskChunk())
      .replace('#include <lights_fragment_begin>',lightsFragmentChunk());
  };
  material.customProgramCacheKey=function(){return `${originalKey}|hybrid-static-and-actor-shadow/v1`;};
  material.userData.hybridCombinedShadowReceiver=true;material.needsUpdate=true;return true;
}

export function enableHybridCombinedShadowReceiver(material){return setHybridCombinedShadowReceiver(material,true);}

function casterVariant(object){
  const kind=object.isSkinnedMesh?'skinned':object.isInstancedMesh?'instanced':object.isBatchedMesh?'batched':'mesh';
  const morph=object.geometry?.morphAttributes||{};
  return `${kind}|${morph.position?.length||0}:${morph.normal?.length||0}:${morph.color?.length||0}:${object.morphTargetInfluences?.length||0}`;
}

export class HybridShadowMaterials{
  constructor(){this.objects=new Map();this.materials=new Map();this.disposed=false;}
  clear(){if(this.disposed)return;for(const [object,record]of [...this.objects])this.release(object,record);}
  release(object,record){
    if(object.customDepthMaterial===record.depth){if(record.previous===undefined)delete object.customDepthMaterial;else object.customDepthMaterial=record.previous;}
    this.objects.delete(object);const entry=this.materials.get(record.key);if(!entry)return;entry.references--;if(entry.references===0){entry.depth.dispose();this.materials.delete(record.key);}
  }
  sync(root){
    if(this.disposed)return;const seen=new Set();
    root.traverse(object=>{
      if(!object.isMesh||!object.castShadow||!object.material||Array.isArray(object.material))return;
      // This material carries no per-source color/texture state. Key only by
      // renderer variant so cloned character materials do not force a material
      // refresh for every skinned caster in the shadow pass.
      const previous=this.objects.get(object),key=casterVariant(object);
      if(previous?.key===key&&object.customDepthMaterial===previous.depth){seen.add(object);return;}
      if(previous)this.release(object,previous);
      if(object.customDepthMaterial)return;
      let entry=this.materials.get(key);if(!entry){entry={depth:new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),references:0};entry.depth.name='hybrid-stable-shadow-depth';this.materials.set(key,entry);}
      const record={key,depth:entry.depth,previous:object.customDepthMaterial};entry.references++;object.customDepthMaterial=entry.depth;this.objects.set(object,record);seen.add(object);
    });
    for(const [object,record]of [...this.objects])if(!seen.has(object))this.release(object,record);
  }
  dispose(){if(this.disposed)return;this.clear();this.disposed=true;}
}
