export const getGoogleClientId=async()=>{
  let bound="";
  try{bound=String((await import("cloudflare:workers") as any).env?.GOOGLE_CLIENT_ID||"")}catch{}
  const runtime=String((globalThis as any).GOOGLE_CLIENT_ID||"");
  const processValue=typeof process!=="undefined"?String((process as any).env?.GOOGLE_CLIENT_ID||""):"";
  return (bound||runtime||processValue).trim();
};
