// Native assets retain their original glTF bytes. Embedded mesh data is already
// in memory; decoding it must not require a data: fetch or a wider connect-src.
// GLB and external buffers continue through GLTFLoader's normal dependency path.
export function registerNativeInlineBuffers(loader){
 return loader.register(parser=>{
  const buffers=new Map();
  const invalid=()=>new Error('Native glTF embedded buffer has invalid encoding, length or range');
  return {
   name:'OFFICE_native_inline_buffers',
   loadBufferView(index){
    const view=parser.json.bufferViews[index],definition=parser.json.buffers[view.buffer];
    if(typeof definition.uri!=='string'||!/^data:/i.test(definition.uri))return null;
    if(!buffers.has(view.buffer))buffers.set(view.buffer,Promise.resolve().then(()=>{
     const match=/^data:application\/(?:octet-stream|gltf-buffer);base64,([\s\S]*)$/i.exec(definition.uri);
     if(!match||definition.type&&definition.type!=='arraybuffer'||!Number.isSafeInteger(definition.byteLength)||definition.byteLength<0)throw invalid();
     let binary;try{binary=atob(match[1]);}catch{throw invalid();}
     if(binary.length!==definition.byteLength)throw invalid();
     return Uint8Array.from(binary,char=>char.charCodeAt(0)).buffer;
    }));
    return buffers.get(view.buffer).then(buffer=>{
     const offset=view.byteOffset??0,length=view.byteLength;
     if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<0||offset>buffer.byteLength-length)throw invalid();
     return buffer.slice(offset,offset+length);
    });
   },
  };
 });
}
