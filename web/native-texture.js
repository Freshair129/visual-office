// Local raster only; normalize before persistence, never store filenames or external URLs.
export async function readTexture(file,win=window){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8000000)throw Error('ใช้ PNG, JPEG หรือ WebP ไม่เกิน 8 MB');
  const url=win.URL.createObjectURL(file);
  try{
    const image=new win.Image();image.src=url;await image.decode();
    if(image.naturalWidth*image.naturalHeight>32000000)throw Error('ภาพใหญ่เกิน 32 ล้านพิกเซล');
    const canvas=win.document.createElement('canvas');
    let data;
    for(const size of [512,384,256,128]){
      const ratio=Math.min(1,size/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      data=canvas.toDataURL('image/png');if(data.length<=180000)break;
    }
    if(data.length>180000)throw Error('บีบอัดภาพไม่ได้ กรุณาใช้ภาพเล็กลง');
    return {data,repeatX:1,repeatY:1,offsetX:0,offsetY:0,rotation:0,opacity:1};
  }finally{win.URL.revokeObjectURL(url);}
}
