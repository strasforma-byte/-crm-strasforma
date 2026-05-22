import React, { useState, useEffect, useMemo } from "react";
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
import { 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  Building2,
  Check,
  ChevronsUpDown,
  Fingerprint
} from "lucide-react";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem,
  CommandList 
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { db } from "@/lib/db";

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

  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

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

  const selectedContact = useMemo(() => 
    state.contacts.find(c => c.id === formData.linkedContactId),
    [state.contacts, formData.linkedContactId]
  );

  const handleQuickContactCreate = async () => {
    if (!quickContact.lastName || !quickContact.company || !quickContact.siret) {
      toast.error("Le Nom, la Société et le SIRET sont obligatoires");
      return;
    }
    
    try {
      const newContactData = {
        createdBy: state.currentUser.id,
        listId: "list-default",
        firstName: quickContact.firstName,
        lastName: quickContact.lastName,
        company: quickContact.company,
        email: quickContact.email,
        phone: quickContact.phone,
        siret: quickContact.siret,
        tags: ["prospect"],
        interactions: [],
        createdAt: new Date().toISOString()
      };
      
      const savedContact = await db.insertContact(newContactData);
      dispatch({ type: "UPDATE_CONTACTS", payload: [...state.contacts, savedContact] });
      setFormData({ ...formData, linkedContactId: savedContact.id });
      setIsQuickContactOpen(false);
      setQuickContact({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
      toast.success("Contact créé et sélectionné");
    } catch (error) {
      toast.error("Erreur lors de la création du contact");
    }
  };

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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposer un Rendez-vous</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 py-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Objet du RDV *</Label>
            <Input 
              placeholder="Ex: Démo produit Alpha" 
              className="h-9 text-xs border-slate-200 bg-slate-50/50"
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Commercial concerné *</Label>
            <Select value={formData.commercialId} onValueChange={val => setFormData({...formData, commercialId: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {state.users.filter(u => u.role === "commercial").map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="flex justify-between items-center text-[11px] uppercase font-black tracking-wider text-slate-500">
              <span>Contact lié *</span>
              <Button variant="ghost" className="h-4 px-1 text-[9px] text-green-600 hover:bg-green-50 font-black" onClick={() => setIsQuickContactOpen(true)}>
                + NOUVEAU
              </Button>
            </Label>
            <Popover open={isClientSearchOpen} onOpenChange={setIsClientSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isClientSearchOpen}
                  className="w-full h-9 justify-between font-medium border-slate-200 bg-slate-50/50"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-xs">
                      {selectedContact 
                        ? `${selectedContact.firstName} ${selectedContact.lastName} (${selectedContact.company})`
                        : "Rechercher..."}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-30" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-slate-100" align="start">
                <Command 
                  className="rounded-lg"
                  filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                  }}
                >
                  <CommandInput placeholder="Nom ou Société..." className="h-9 text-xs" />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty className="py-2 text-[10px] text-slate-400 text-center">Aucun résultat</CommandEmpty>
                    <CommandGroup>
                      {state.contacts.map((c) => {
                        const searchValue = `${c.firstName} ${c.lastName} ${c.company}`.toLowerCase();
                        return (
                          <CommandItem
                            key={c.id}
                            value={searchValue}
                            className="py-1 px-2 cursor-pointer"
                            onSelect={() => {
                              setFormData({ ...formData, linkedContactId: c.id });
                              setIsClientSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3 text-green-600",
                                formData.linkedContactId === c.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-[11px] truncate">{c.firstName} {c.lastName}</span>
                              <span className="text-[9px] text-slate-400 uppercase truncate font-medium">{c.company}</span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Durée (min)</Label>
            <Select value={formData.duration} onValueChange={val => setFormData({...formData, duration: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30" className="text-xs">30 min</SelectItem>
                <SelectItem value="45" className="text-xs">45 min</SelectItem>
                <SelectItem value="60" className="text-xs">1h</SelectItem>
                <SelectItem value="90" className="text-xs">1h30</SelectItem>
                <SelectItem value="120" className="text-xs">2h</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Date proposée</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 justify-start text-left font-medium text-xs border-slate-200 bg-slate-50/50">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
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

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Heure proposée</Label>
            <Input 
              type="time" 
              className="h-9 text-xs border-slate-200 bg-slate-50/50"
              value={formData.proposedTime} 
              onChange={e => setFormData({...formData, proposedTime: e.target.value})} 
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Notes pour le commercial</Label>
            <Textarea 
              placeholder="Précisez le contexte du RDV..." 
              className="min-h-[80px] text-xs border-slate-200 bg-slate-50/50" 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={handlePropose}>Envoyer la proposition</Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={isQuickContactOpen} onOpenChange={setIsQuickContactOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Créer un contact rapidement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={quickContact.firstName} onChange={e => setQuickContact({...quickContact, firstName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={quickContact.lastName} onChange={e => setQuickContact({...quickContact, lastName: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entreprise *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input className="pl-10" value={quickContact.company} onChange={e => setQuickContact({...quickContact, company: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SIRET *</Label>
              <div className="relative">
                <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input className="pl-10" value={quickContact.siret} onChange={e => setQuickContact({...quickContact, siret: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={quickContact.email} onChange={e => setQuickContact({...quickContact, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={quickContact.phone} onChange={e => setQuickContact({...quickContact, phone: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickContactOpen(false)}>Annuler</Button>
            <Button className="bg-green-600" onClick={handleQuickContactCreate}>Créer et sélectionner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
