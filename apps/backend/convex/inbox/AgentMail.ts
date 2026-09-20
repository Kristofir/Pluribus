import { object,providerJson,text } from "../integrations/Http";
function key(){const value=process.env.AGENTMAIL_API_KEY;if(!value)throw new Error("AgentMail is not configured");return value;}
export const mailboxAddress=(value:string)=>value.match(/<([^>]+)>/)?.[1]?.trim().toLowerCase()??value.trim().toLowerCase();
const addressList=(value:unknown)=>Array.isArray(value) ? value.map(v=>text(v,500)).slice(0,20) : typeof value==="string" ? [text(value,500)] : [];
/** A bounded read adapter; no inbox creation, webhook registration or implicit send. */
export async function readInbox(inboxId:string) {
 const headers={Authorization:`Bearer ${key()}`},base=`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}`;
 const list=object(await providerJson(`${base}/threads?limit=10`,{headers}));
 if(!Array.isArray(list.threads))throw new Error("Invalid thread response");
 const results=[];
 for(const item of list.threads.slice(0,10)) {
  const summary=object(item),providerId=text(summary.thread_id,1000);
  const response=object(await providerJson(`${base}/threads/${encodeURIComponent(providerId)}?limit=20`,{headers}));
  if(!Array.isArray(response.messages))throw new Error("Invalid messages");
  const messages=response.messages.slice(-20).map(raw=>{const m=object(raw);const from=text(m.from,1000),labels=Array.isArray(m.labels)?m.labels:[];
 const direction=labels.includes("sent") ? "outgoing" as const : labels.includes("received") ? "incoming" as const : inboxId.includes("@") ? mailboxAddress(from)===mailboxAddress(inboxId) ? "outgoing" as const : "incoming" as const : "unknown" as const;
 const headers=m.headers && typeof m.headers==="object" && !Array.isArray(m.headers) ? m.headers as Record<string,unknown> : {};
 const intent=Object.entries(headers).find(([k])=>k.toLowerCase()==="x-pluribus-intent")?.[1];
 return {id:text(m.message_id,1000),from,direction,replyTo:addressList(m.reply_to),...(typeof intent==="string" ? {intentId:text(intent,100)}:{}),to:addressList(m.to),subject:typeof m.subject==="string" ? text(m.subject,1000) : undefined,text:text(m.text??m.extracted_text??m.preview??"",20000),sentAt:typeof m.timestamp==="string" ? text(m.timestamp,100) : undefined};});
  results.push({providerId,subject:typeof response.subject==="string" ? text(response.subject,1000) : "No subject",messages,truncated:!!response.next_page_token});
 }
 return results;
}
/** Only the send-intent worker calls this. A thrown response is conservatively uncertain. */
export async function sendReply(input:{inboxId:string;messageId:string;recipients:string[];text:string;intentId:string}) {
 const result=object(await providerJson(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/${encodeURIComponent(input.messageId)}/reply`,{method:"POST",headers:{Authorization:`Bearer ${key()}`,"Content-Type":"application/json"},body:JSON.stringify({to:input.recipients,cc:[],bcc:[],reply_all:false,text:input.text,headers:{"X-Pluribus-Intent":input.intentId}})}));
 return {messageId:text(result.message_id,1000)};
}

/** Positive provider evidence only. Absence from a bounded read does not prove failure. */
export async function findSentIntent(input:{inboxId:string;threadId:string;intentId:string}) {
 const headers={Authorization:`Bearer ${key()}`},base=`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(input.inboxId)}`;
 const thread=object(await providerJson(`${base}/threads/${encodeURIComponent(input.threadId)}?limit=20`,{headers}));
 if(!Array.isArray(thread.messages))throw new Error("Invalid thread response");
 for(const raw of thread.messages.slice(-20)) {
  const row=object(raw),messageId=text(row.message_id,1000);
  if(!Array.isArray(row.labels) || !row.labels.includes("sent"))continue;
  const message=object(await providerJson(`${base}/messages/${encodeURIComponent(messageId)}`,{headers}));
  const values=message.headers && typeof message.headers==="object" && !Array.isArray(message.headers) ? message.headers as Record<string,unknown> : {};
  if(Object.entries(values).some(([name,value])=>name.toLowerCase()==="x-pluribus-intent" && value===input.intentId))return messageId;
 }
 return null;
}
