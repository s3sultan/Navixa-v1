import {NextRequest,NextResponse} from "next/server";

const GOOGLE_CLIENT_ID="876266145464-51o36n0s7jkgrtd0vhqh2cai1koo05r6.apps.googleusercontent.com";
const ADMIN_EMAIL="s2shug@gmail.com";

export async function proxy(request:NextRequest){
  if(request.nextUrl.pathname==="/admin/login")return NextResponse.next();
  const token=request.cookies.get("navixa_google_token")?.value;
  if(!token)return NextResponse.redirect(new URL("/admin/login",request.url));
  try{
    const check=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,{cache:"no-store"});
    if(check.ok){const profile=await check.json() as {aud?:string;email?:string;email_verified?:string|boolean};const verified=profile.email_verified===true||profile.email_verified==="true";if(profile.aud===GOOGLE_CLIENT_ID&&verified&&profile.email?.toLowerCase()===ADMIN_EMAIL)return NextResponse.next()}
  }catch{}
  const response=NextResponse.redirect(new URL("/admin/login",request.url));response.cookies.delete("navixa_google_token");return response;
}

export const config={matcher:["/admin/:path*"]};
