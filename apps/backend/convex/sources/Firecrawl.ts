import { providerJson, object, text } from "../integrations/Http";
/** Only the provider fetches target pages; input checks reject literal/private destinations. DNS/redirect enforcement remains provider-owned. */
export function publicSourceUrl(raw:string) {
 if(raw.length>2048)throw new Error("URL too long");const url=new URL(raw);
 if(!["http:","https:"].includes(url.protocol) || url.username || url.password || url.port || !url.hostname.includes(".") || /^(\d+\.){3}\d+$/.test(url.hostname) || url.hostname.includes(":") || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname))throw new Error("Use a public HTTP or HTTPS page");
 return url.href;
}
export async function scrapePage(input:{url:string;prompt?:string}) {
 const key=process.env.FIRECRAWL_API_KEY;if(!key)throw new Error("Firecrawl is not configured");
 const response=object(await providerJson("https://api.firecrawl.dev/v2/scrape",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({url:publicSourceUrl(input.url),formats:input.prompt ? ["markdown",{type:"json",prompt:input.prompt}] : ["markdown"],onlyMainContent:true,timeout:25000,proxy:"basic"})}));
 if(response.success!==true)throw new Error("Firecrawl could not retrieve this page");
 const data=object(response.data),content=data.markdown===undefined ? "" : text(data.markdown),structured=data.json===undefined ? undefined : JSON.stringify(data.json);
 if(structured && structured.length>100000)throw new Error("Extracted result too large");
 return {content,...(structured ? {data:structured}: {})};
}
