import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { Button } from "@/components/ui/Button";
import { SendReview } from "./SendReview";
type Review=FunctionReturnType<typeof api.Inbox.review> & {requestId:string};
export function ReplyReview({threadId,pending,paused}:{threadId:Id<"inboxThreads">;pending:boolean;paused:boolean}) {
 const client=useConvex(),send=useMutation(api.Inbox.send),reconcile=useMutation(api.Inbox.reconcile);
 const current=useRetainedQuery(api.Inbox.review,{threadId}),delivery=useRetainedQuery(api.Inbox.delivery,{threadId});
 const [review,setReview]=useState<Review>(),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[attempted,setAttempted]=useState(false);
 const uncertain=delivery.data?.status==="unknown";
 const unsettled=delivery.data&&["pending","sending","unknown"].includes(delivery.data.status);
 const changed=review&&current.data&&(review.version!==current.data.version||review.reviewedMessageId!==current.data.reviewedMessageId||JSON.stringify(review.recipients)!==JSON.stringify(current.data.recipients));
 const blocked=paused?"Editing is paused while workspace access is unavailable.":pending?"Wait for all local edits to save before reviewing or sending.":current.failed||delivery.failed?"Draft or delivery status is unavailable.":!current.data?"Loading saved draft…":changed?"The draft or reply target changed. Review the latest version before sending.":!review?.reviewedMessageId?"There is no received message to reply to.":undefined;
 return <section className="mt-8 space-y-4" aria-label="Reply delivery">
 {error&&<p role="alert" className="text-sm">{error}</p>}
 <Button intent="outline" isDisabled={pending||paused||busy||!!unsettled||current.failed||delivery.failed||(!delivery.data&&attempted)} onPress={async()=>{setBusy(true);setError(undefined);try{const saved=await client.query(api.Inbox.review,{threadId});setReview({...saved,requestId:crypto.randomUUID()});setAttempted(false);}catch{setError("The saved draft could not be loaded for review.");}finally{setBusy(false);}}}>{busy?"Loading review…":review?"Review latest saved draft":"Review before sending"}</Button>
 {review&&<SendReview key={review.requestId} recipients={review.recipients} reviewedText={review.text} draftVersion={review.version} currentVersion={current.data?.version??review.version} blockedReason={blocked} send={delivery.data&&attempted?{...delivery.data,status:delivery.data.status==="unknown"?"uncertain":delivery.data.status}:undefined} onSend={async()=>{
   if(blocked||!review.reviewedMessageId||unsettled)throw new Error("Send blocked");
   setAttempted(true);
   // Never replace the frozen message ID, text, recipients or version at submit time.
   await send({threadId,requestId:review.requestId,reviewedMessageId:review.reviewedMessageId,draftVersion:review.version,text:review.text,recipients:review.recipients});
 }}/>} 
 {delivery.data&&!attempted&&<p role="status" className="text-sm">Previous delivery: {uncertain?"unconfirmed":delivery.data.status}{delivery.data.error?` — ${delivery.data.error}`:""}</p>}
 {(uncertain||attempted)&&<Button intent="outline" isDisabled={busy||paused||delivery.failed} onPress={async()=>{setBusy(true);setError(undefined);try{await reconcile({threadId});}catch{setError("Delivery could not be confirmed. Do not resend while its status is unknown.");}finally{setBusy(false);}}}>Check delivery</Button>}
 </section>;
}
