"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { StaffRole, StaffUser } from "@/lib/staff/service";
const roles:StaffRole[]=["owner","manager","reception","waiter","kitchen","cashier"];
const today=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});
export function StaffManager(){
  const {data,error,refresh}=useData<StaffUser[]>("/api/admin/staff"),[message,setMessage]=useState(""),[failure,setFailure]=useState(""),[busy,setBusy]=useState(false);
  async function create(form:HTMLFormElement){setBusy(true);setFailure("");const f=new FormData(form);try{await api("/api/admin/staff",{name:f.get("name"),phone:f.get("phone"),email:f.get("email"),password:f.get("password"),role:f.get("role"),joinedOn:f.get("joinedOn"),shiftStart:f.get("shiftStart")||null,shiftEnd:f.get("shiftEnd")||null,baseSalary:Number(f.get("baseSalary"))});form.reset();setMessage("Staff account created");await refresh();}catch(e){setFailure((e as Error).message)}finally{setBusy(false)}}
  async function toggle(staff:StaffUser){setBusy(true);try{await api(`/api/admin/staff/${staff.id}`,{status:staff.status==="active"?"inactive":"active"},"PATCH");setMessage(`${staff.name} is now ${staff.status==="active"?"inactive":"active"}`);await refresh();}catch(e){setFailure((e as Error).message)}finally{setBusy(false)}}
  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
    <form className="panel self-start" onSubmit={e=>{e.preventDefault();void create(e.currentTarget)}}><h2 className="serif text-2xl">Add staff member</h2><div className="mt-5 grid gap-4">
      <label className="field-label">Name<input className="field-control" name="name" required minLength={2}/></label>
      <label className="field-label">Phone<input className="field-control" name="phone" required placeholder="9876543210"/></label>
      <label className="field-label">Email<input className="field-control" name="email" type="email" required/></label>
      <label className="field-label">Temporary password<input className="field-control" name="password" type="password" minLength={8} required/></label>
      <label className="field-label">Role<select className="field-control" name="role">{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
      <label className="field-label">Join date<input className="field-control" name="joinedOn" type="date" defaultValue={today()} required/></label>
      <div className="grid grid-cols-2 gap-3"><label className="field-label">Shift start<input className="field-control" name="shiftStart" type="time"/></label><label className="field-label">Shift end<input className="field-control" name="shiftEnd" type="time"/></label></div><label className="field-label">Monthly salary (paise)<input className="field-control" name="baseSalary" type="number" min="0" defaultValue="0" required/></label>
    </div><Notice message={failure||error}/><Notice message={message} success/><button className="btn mt-5 w-full" disabled={busy}>{busy?"Saving…":"Create account"}</button></form>
    <section>{!data?<Loading error={error}/>:<div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs text-stone-500"><tr>{["Staff member","Role","Shift","Joined","Status","Action"].map(h=><th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{data.map(s=><tr className="border-t border-stone-100" key={s.id}><td className="p-4"><p className="font-semibold">{s.name}</p><p className="text-xs text-stone-500">{s.email}<br/>{s.phone}</p></td><td className="p-4 capitalize">{s.role}</td><td className="p-4 text-stone-500">{s.shift_start?.slice(0,5)||"—"} – {s.shift_end?.slice(0,5)||"—"}</td><td className="p-4">{s.joined_on}</td><td className="p-4"><Badge status={s.status}/></td><td className="p-4"><button className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold" disabled={busy} onClick={()=>toggle(s)}>{s.status==="active"?"Deactivate":"Activate"}</button></td></tr>)}</tbody></table>{!data.length&&<p className="p-10 text-center text-stone-500">No staff accounts yet. Add the first account here.</p>}</div>}</section>
  </div>
}
