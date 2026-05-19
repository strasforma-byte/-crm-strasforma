import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, User as UserIcon, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function RdvProposalDialog({ open, onOpenChange, commercialId, defaultDate }) {
  const { state, dispatch } = useApp();
  
  const [formData, setFormData] = useState({
    title: "",
    commercialId: commercialId || "",
    linkedContactId: "",
    linkedCardId: "none",
    proposedDate: defaultDate || new Date(),
    proposedTime: "10:00",
    duration: "60",
    notes: ""
  });

  useEffect(() => {
    if (open) {
      setFormData({
        title: "",
        commercialId: commercialId || state.users.find(u => u.role === "commercial")?.id || "",
        linkedContactId: state.contacts[0]?.id || "",
        linkedCardId: "none",
        proposedDate: defaultDate || new Date(),
        proposedTime: "10:00",
        duration: "60",
        notes: ""
      });
    }
  }, [open, commercialId, defaultDate, state.users, state.contacts]);

  const handlePropose = () => {
    if (!formData.title || !formData.commercialId || !formData.linkedContactId) {
      toast.error("Veuillez remplir les informations essentielles");
      return;
    }

    const propDate = new Date(formData.proposedDate);
    const [h, m] = formData.proposedTime.split(":").map(Number);
    propDate.setHours(h, m);

    const newProposal = {
      id: "prop-" + Date.now(),
      prospectorId: state.currentUser.id,
      commercialId: formData.commercialId,
      title: formData.title,
      linkedContactId: formData.linkedContactId,
      linkedCardId: formData.linkedCardId === "none" ? null : formData.linkedCardId,
      proposedDate: propDate.toISOString(),
      duration: parseInt(formData.duration),
      notes: formData.notes,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    const newNotif = {
      id: "n" + Date.now(),
      userId: formData.commercialId,
      type: "rdv_proposal",
      message: `${state.currentUser.name} vous propose un RDV : ${formData.title}`,
      relatedId: newProposal.id,
      read: false,
      createdAt: new Date().toISOString()
    };

    dispatch({ type: "UPDATE_PROPOSALS", payload: [...state.rdvProposals, newProposal] });
    dispatch({ type: "UPDATE_NOTIFICATIONS", payload: [...state.notifications, newNotif] });
    
    toast.success("Proposition de RDV envoyée !");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Proposer un Rendez-vous</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 space-y-2">
            <Label>Objet du RDV *</Label>
            <Input 
              placeholder="Ex: Démo produit Alpha" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Commercial concerné *</Label>
            <Select value={formData.commercialId} onValueChange={val => setFormData({...formData, commercialId: val})}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {state.users.filter(u => u.role === "commercial").map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contact lié *</Label>
            <Select value={formData.linkedContactId} onValueChange={val => setFormData({...formData, linkedContactId: val})}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {state.contacts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Durée (min)</Label>
            <Select value={formData.duration} onValueChange={val => setFormData({...formData, duration: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">1h</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2h</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date proposée</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                  {format(formData.proposedDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.proposedDate}
                  onSelect={date => setFormData({...formData, proposedDate: date || new Date()})}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Heure proposée</Label>
            <Input type="time" value={formData.proposedTime} onChange={e => setFormData({...formData, proposedTime: e.target.value})} />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Notes pour le commercial</Label>
            <Textarea 
              placeholder="Précisez le contexte du RDV..." 
              className="min-h-[80px]" 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={handlePropose}>Envoyer la proposition</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
