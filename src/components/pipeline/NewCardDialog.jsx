import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { 
  Building2, 
  User as UserIcon, 
  Euro, 
  Check, 
  ChevronsUpDown,
  Fingerprint,
  Loader2
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

export default function NewCardDialog({ open, onOpenChange, defaultPipelineId, defaultContactId, defaultColumnId }) {
  const { state, dispatch } = useApp();
  
  const [formData, setFormData] = useState({
    title: "",
    clientId: "",
    value: "",
    fundingSource: "FOND PROPRE",
    pipelineId: defaultPipelineId || "",
    columnId: defaultColumnId || "",
    responsibleId: state.currentUser?.id || ""
  });

  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  const filteredContactsForSearch = useMemo(() => {
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    if (!clientSearchTerm.trim()) return contacts.slice(0, 50);
    const term = clientSearchTerm.toLowerCase();
    return contacts.filter(c => 
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
      (c.company || "").toLowerCase().includes(term)
    ).slice(0, 50);
  }, [state.contacts, clientSearchTerm]);

  useEffect(() => {
    if (open) {
      const pipeId = defaultPipelineId || (state.pipelines && state.pipelines[0]?.id) || "";
      const pipeline = state.pipelines?.find(p => p.id === pipeId);
      
      // Auto-assign based on defaultContactId if provided
      let initialResponsibleId = state.currentUser?.id || "";
      if (defaultContactId) {
        const contact = state.contacts.find(c => c.id === defaultContactId);
        if (contact?.assignedAgentId) {
          initialResponsibleId = contact.assignedAgentId;
        }
      }

      setFormData(prev => ({
        ...prev,
        title: "",
        clientId: defaultContactId || "",
        value: "",
        fundingSource: "FOND PROPRE",
        pipelineId: pipeId,
        columnId: defaultColumnId || (pipeline && pipeline.columns && pipeline.columns[0]?.id) || "",
        responsibleId: initialResponsibleId
      }));
    }
  }, [open, defaultPipelineId, defaultContactId, defaultColumnId]);

  // Intelligent Auto-Assignment when clientId changes manually
  useEffect(() => {
    if (formData.clientId) {
      const contact = state.contacts.find(c => c.id === formData.clientId);
      if (contact?.assignedAgentId && contact.assignedAgentId !== formData.responsibleId) {
        setFormData(prev => ({ ...prev, responsibleId: contact.assignedAgentId }));
        toast.info(`Responsable auto-assigné : ${state.users.find(u => u.id === contact.assignedAgentId)?.name}`, {
          description: "Le responsable de l'affaire a été synchronisé avec le responsable du contact.",
          duration: 3000
        });
      }
    }
  }, [formData.clientId, state.contacts, state.users]);

  const handleQuickContactCreate = async () => {
    if (isCreatingContact) return;

    if (!quickContact.lastName || !quickContact.company || !quickContact.siret) {
      toast.error("Le Nom, la Société et le SIRET sont obligatoires");
      return;
    }

    if (!state.currentUser) {
      toast.error("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    // Check for duplicates in local state to avoid server error
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const existing = contacts.find(c => c.siret === quickContact.siret);
    if (existing) {
      toast.error(`Un contact avec ce SIRET existe déjà : ${existing.company} (${existing.firstName} ${existing.lastName})`);
      return;
    }

    setIsCreatingContact(true);
    
    try {
      const newContactData = {
        createdBy: state.currentUser.id,
        listId: "list-default",
        firstName: quickContact.firstName || "",
        lastName: quickContact.lastName,
        company: quickContact.company,
        email: quickContact.email || "",
        phone: quickContact.phone || "",
        siret: quickContact.siret,
        tags: ["prospect"],
        interactions: [],
        createdAt: new Date().toISOString()
      };
      
      const savedContact = await db.insertContact(newContactData);
      
      if (!savedContact) {
        throw new Error("La création a échoué (réponse vide)");
      }

      // Use functional update to avoid losing other newly created contacts in rapid succession
      dispatch({ type: "UPDATE_CONTACTS", payload: (prev) => [...prev, savedContact] });
      
      setFormData(prev => ({ ...prev, clientId: savedContact.id }));
      setIsQuickContactOpen(false);
      setQuickContact({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
      toast.success("Contact créé et sélectionné");
    } catch (error) {
      console.error("Contact creation error:", error);
      toast.error(`Erreur : ${error.message || "Vérifiez si le SIRET n'existe pas déjà."}`);
    } finally {
      setIsCreatingContact(false);
    }
  };

  const handlePipelineChange = (pipeId) => {
    const pipeline = state.pipelines.find(p => p.id === pipeId);
    setFormData({
      ...formData,
      pipelineId: pipeId,
      columnId: (pipeline && pipeline.columns && pipeline.columns[0]?.id) || ""
    });
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.clientId || !formData.pipelineId || !formData.columnId) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const newCardData = {
        columnId: formData.columnId,
        contactId: formData.clientId,
        title: formData.title,
        value: parseFloat(formData.value) || 0,
        fundingSource: formData.fundingSource,
        responsibleId: formData.responsibleId,
        priority: "medium",
        tags: [],
        order: 0,
        history: [
          { date: new Date().toISOString(), userId: state.currentUser.id, action: "Affaire créée" }
        ]
      };

      const savedCard = await db.insertCard(newCardData);
      
      dispatch({ 
        type: "UPDATE_PIPELINES", 
        payload: (prev) => prev.map(p => {
          if (p.id === formData.pipelineId) {
            return {
              ...p,
              columns: p.columns.map(col => {
                if (col.id === formData.columnId) {
                  return { 
                    ...col, 
                    cards: [...(col.cards || []), {
                      id: savedCard.id,
                      title: savedCard.title,
                      value: savedCard.value,
                      fundingSource: savedCard.fundingSource,
                      priority: savedCard.priority,
                      tags: savedCard.tags || [],
                      order: savedCard.order,
                      contactId: savedCard.contactId
                    }] 
                  };
                }
                return col;
              })
            };
          }
          return p;
        })
      });
      toast.success("Affaire créée avec succès");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Erreur lors de la création de l'affaire");
    }
  };

  const selectedContact = useMemo(() => 
    state.contacts.find(c => c.id === formData.clientId),
    [state.contacts, formData.clientId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle Affaire</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Titre de l'affaire *</Label>
            <Input 
              placeholder="Ex: Refonte Site Web" 
              className="h-9 text-xs border-slate-200 bg-slate-50/50"
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex justify-between items-center text-[11px] uppercase font-black tracking-wider text-slate-500">
              <span>Client lié *</span>
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
                  shouldFilter={false}
                >
                  <CommandInput 
                    placeholder="Nom ou Société..." 
                    className="h-9 text-xs"
                    onValueChange={setClientSearchTerm}
                  />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty className="py-2 text-[10px] text-slate-400 text-center">Aucun résultat</CommandEmpty>
                    <CommandGroup>
                      {filteredContactsForSearch.map((c) => {
                        const searchValue = `${c.firstName} ${c.lastName} ${c.company}`.toLowerCase();
                        return (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            className="py-1 px-2 cursor-pointer"
                            onSelect={() => {
                              setFormData({ ...formData, clientId: c.id });
                              setIsClientSearchOpen(false);
                              setClientSearchTerm("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3 text-green-600",
                                formData.clientId === c.id ? "opacity-100" : "opacity-0"
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
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Valeur (€)</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input 
                type="number" 
                className="pl-9 h-9 text-xs border-slate-200 bg-slate-50/50" 
                value={formData.value} 
                onChange={e => setFormData({...formData, value: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Pipeline *</Label>
            <Select value={formData.pipelineId} onValueChange={handlePipelineChange}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Étape *</Label>
            <Select value={formData.columnId} onValueChange={val => setFormData({...formData, columnId: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(state.pipelines.find(p => p.id === formData.pipelineId)?.columns || []).map(col => (
                  <SelectItem key={col.id} value={col.id} className="text-xs">{col.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Source de financement</Label>
            <Select value={formData.fundingSource} onValueChange={val => setFormData({...formData, fundingSource: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["OPCO", "CPF", "AGEFICE", "FAFCEA", "FIFPL", "FOND PROPRE"].map(source => (
                  <SelectItem key={source} value={source} className="text-xs">{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Responsable</Label>
            <Select value={formData.responsibleId} onValueChange={val => setFormData({...formData, responsibleId: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {state.users.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleCreate}>Créer l'affaire</Button>
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
            <Button className="bg-green-600" onClick={handleQuickContactCreate} disabled={isCreatingContact}>
              {isCreatingContact ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : "Créer et sélectionner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
