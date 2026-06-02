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
  Clock, 
  Check, 
  Trash2, 
  Building2, 
  ChevronsUpDown, 
  Fingerprint,
  User as UserIcon,
  Briefcase,
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

export default function TaskDialog({ task, open, onOpenChange, defaultContactId, defaultCardId }) {
  const { state, dispatch, isAdmin } = useApp();
  
  const [formData, setFormData] = useState({
    title: "",
    type: "call",
    date: new Date(),
    time: "09:00",
    duration: "30",
    linkedContactId: "none",
    linkedCardId: "none",
    userId: state.currentUser?.id || "",
    notes: "",
    status: "pending"
  });

  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        date: new Date(task.date),
        linkedContactId: task.linkedContactId || "none",
        linkedCardId: task.linkedCardId || "none",
      });
    } else {
      setFormData({
        title: "",
        type: "call",
        date: new Date(),
        time: "09:00",
        duration: "30",
        linkedContactId: defaultContactId || "none",
        linkedCardId: defaultCardId || "none",
        userId: state.currentUser?.id || "",
        notes: "",
        status: "pending"
      });
    }
  }, [task, open, defaultContactId, defaultCardId]);

  const selectedContact = useMemo(() => 
    state.contacts.find(c => c.id === formData.linkedContactId),
    [state.contacts, formData.linkedContactId]
  );

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

      dispatch({ type: "UPDATE_CONTACTS", payload: [...contacts, savedContact] });
      setFormData({ ...formData, linkedContactId: savedContact.id });
      setIsQuickContactOpen(false);
      setQuickContact({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
      toast.success("Contact créé et sélectionné");
    } catch (error) {
      console.error("Contact creation error:", error);
      toast.error(`Erreur : ${error.message || "Problème lors de la création"}`);
    } finally {
      setIsCreatingContact(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      toast.error("Veuillez entrer un titre");
      return;
    }

    try {
      const taskDate = new Date(formData.date);
      const [hours, minutes] = formData.time.split(":").map(Number);
      taskDate.setHours(hours, minutes);

      // Sécurité : s'assurer qu'un utilisateur est assigné
      const assignedUserId = formData.userId || state.currentUser?.id;
      if (!assignedUserId) {
        toast.error("Impossible d'identifier l'utilisateur responsable");
        return;
      }

      const taskData = {
        title: formData.title,
        type: formData.type,
        description: formData.notes,
        dueDate: taskDate.toISOString(),
        status: formData.status,
        assignedTo: assignedUserId,
        contactId: formData.linkedContactId,
        linkedCardId: formData.linkedCardId
      };

      if (task) {
        const savedTask = await db.updateTask(task.id, taskData);
        const updated = state.tasks.map(t => t.id === task.id ? savedTask : t);
        dispatch({ type: "UPDATE_TASKS", payload: updated });
        toast.success("Action mise à jour");
      } else {
        const savedTask = await db.insertTask(taskData);
        dispatch({ type: "UPDATE_TASKS", payload: [...state.tasks, savedTask] });

        // Audit automatique pour les nouvelles tâches liées
        if (taskData.linkedCardId) {
          const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === taskData.linkedCardId)));
          if (pipeline) {
            const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === taskData.linkedCardId);
            if (card) {
              const historyEntry = {
                date: new Date().toISOString(),
                userId: assignedUserId,
                action: `Nouvelle action planifiée : ${taskData.title}`
              };
              const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
              await db.updateCard(card.id, updatedCard);
              
              const updatedPipelines = state.pipelines.map(p => p.id === pipeline.id ? {
                ...p,
                columns: p.columns.map(col => ({
                  ...col,
                  cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
                }))
              } : p);
              dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
            }
          }
        }

        toast.success("Action planifiée");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving task:", error);
      const msg = error.message || "Problème de connexion";
      toast.error(`Erreur lors de l'enregistrement : ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    
    try {
      // 1. Delete from DB
      await db.deleteTask(task.id);

      // 2. Update local state
      const updated = state.tasks.filter(t => t.id !== task.id);
      dispatch({ type: "UPDATE_TASKS", payload: updated });

      // 3. If linked to a card, update its history
      if (task.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Action supprimée : ${task.title}`
            };
            const updatedCard = {
              ...card,
              history: [historyEntry, ...(card.history || [])]
            };
            await db.updateCard(card.id, updatedCard);
            
            const updatedPipelines = state.pipelines.map(p => {
              if (p.id === pipeline.id) {
                return {
                  ...p,
                  columns: p.columns.map(col => ({
                    ...col,
                    cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
                  }))
                };
              }
              return p;
            });
            dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
          }
        }
      }

      toast.success("Tâche supprimée");
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Erreur lors de la suppression de la tâche");
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = formData.status === "done" ? "pending" : "done";
    setFormData({...formData, status: newStatus});
    
    try {
      if (task) {
        const updatedTaskData = { ...task, status: newStatus };
        await db.updateTask(task.id, updatedTaskData);
        
        const updatedTasks = state.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
        dispatch({ type: "UPDATE_TASKS", payload: updatedTasks });

        // If linked to a card, update its history
        if (task.linkedCardId) {
          const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
          if (pipeline) {
            const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
            if (card) {
              const historyEntry = {
                date: new Date().toISOString(),
                userId: state.currentUser.id,
                action: newStatus === "done" ? `Action terminée : ${task.title}` : `Action réouverte : ${task.title}`
              };
              const updatedCard = {
                ...card,
                history: [historyEntry, ...(card.history || [])]
              };
              await db.updateCard(card.id, updatedCard);
              
              const updatedPipelines = state.pipelines.map(p => {
                if (p.id === pipeline.id) {
                  return {
                    ...p,
                    columns: p.columns.map(col => ({
                      ...col,
                      cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
                    }))
                  };
                }
                return p;
              });
              dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
            }
          }
        }

        toast.success(newStatus === "done" ? "Tâche terminée !" : "Tâche réouverte");
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error toggling task status:", error);
      toast.error("Erreur lors de la mise à jour de la tâche");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 py-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Titre *</Label>
            <Input 
              value={formData.title} 
              className="h-9 text-xs border-slate-200 bg-slate-50/50"
              onChange={e => setFormData({...formData, title: e.target.value})} 
              placeholder="Ex: Rappeler client" 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Type</Label>
            <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call" className="text-xs">📞 Appel</SelectItem>
                <SelectItem value="email" className="text-xs">📧 Email</SelectItem>
                <SelectItem value="meeting" className="text-xs">🤝 RDV</SelectItem>
                <SelectItem value="relance" className="text-xs">🔔 Relance</SelectItem>
                <SelectItem value="other" className="text-xs">📌 Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Durée (min)</Label>
            <Select value={formData.duration} onValueChange={val => setFormData({...formData, duration: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15" className="text-xs">15 min</SelectItem>
                <SelectItem value="30" className="text-xs">30 min</SelectItem>
                <SelectItem value="45" className="text-xs">45 min</SelectItem>
                <SelectItem value="60" className="text-xs">1h</SelectItem>
                <SelectItem value="120" className="text-xs">2h</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 justify-start text-left font-medium text-xs border-slate-200 bg-slate-50/50">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                  {format(formData.date, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={date => setFormData({...formData, date: date || new Date()})}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Heure</Label>
            <Input 
              type="time" 
              className="h-9 text-xs border-slate-200 bg-slate-50/50"
              value={formData.time} 
              onChange={e => setFormData({...formData, time: e.target.value})} 
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="flex justify-between items-center text-[11px] uppercase font-black tracking-wider text-slate-500">
              <span>Contact lié</span>
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
                      <CommandItem
                        value="aucun"
                        className="py-1 px-2 cursor-pointer text-xs italic text-slate-400"
                        onSelect={() => {
                          setFormData({ ...formData, linkedContactId: "none" });
                          setIsClientSearchOpen(false);
                        }}
                      >
                        Aucun
                      </CommandItem>
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

          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Affaire liée</Label>
            <Select value={formData.linkedCardId} onValueChange={val => setFormData({...formData, linkedCardId: val})}>
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs italic">Aucune</SelectItem>
                {(Array.isArray(state.pipelines) ? state.pipelines : []).flatMap(p => (p.columns || []).flatMap(col => (col.cards || []))).map(card => (
                  <SelectItem key={card.id} value={card.id} className="text-xs">{card.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Assigné à</Label>
              <Select value={formData.userId} onValueChange={val => setFormData({...formData, userId: val})}>
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
          )}

          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Notes</Label>
            <Textarea 
              className="min-h-[80px] text-xs border-slate-200 bg-slate-50/50" 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {task && (
              <Button variant="outline" size="icon" className="h-9 w-9 text-red-600 border-red-100 hover:bg-red-50" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {task && (
              <Button variant="outline" className={cn("h-9 text-xs", formData.status === 'done' ? 'text-blue-600 border-blue-100 hover:bg-blue-50' : 'text-green-600 border-green-100 hover:bg-green-50')} onClick={handleToggleStatus}>
                <Check className="w-4 h-4 mr-2" />
                {formData.status === 'done' ? "Réouvrir" : "Terminer"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button className="h-9 text-xs bg-green-600 hover:bg-green-700" onClick={handleSave}>Enregistrer</Button>
          </div>
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
