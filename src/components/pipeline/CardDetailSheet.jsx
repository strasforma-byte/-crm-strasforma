import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Briefcase, 
  Building2, 
  Calendar as CalendarIcon, 
  Check, 
  CheckSquare, 
  ChevronsUpDown, 
  Clock, 
  Euro, 
  Plus, 
  Trash2, 
  User as UserIcon,
  MessageSquare,
  CheckCircle2,
  Fingerprint,
  Tag as TagIcon,
  Loader2,
  Phone,
  Mail,
  StickyNote
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TaskDialog from "@/components/agenda/TaskDialog";

const PRESET_TAGS = [
  { label: "Urgent ⚡", value: "urgent", color: "bg-red-100 text-red-700 border-red-200" },
  { label: "Partenaire 🤝", value: "partenaire", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { label: "Premium ⭐", value: "premium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "Suivi requis 🔔", value: "follow-up", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { label: "En attente ⏳", value: "on-hold", color: "bg-slate-100 text-slate-700 border-slate-200" }
];

export default function CardDetailSheet({ card, pipeline, open, onOpenChange }) {
  const { state, dispatch, refreshAllData } = useApp();
  
  const [formData, setFormData] = useState({
    title: "",
    clientId: "",
    value: 0,
    fundingSource: "",
    responsibleId: "",
    pipelineId: "",
    columnId: "",
    notes: "",
    tags: []
  });

  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [tempFollowUpNote, setTempFollowUpNote] = useState("");

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
    if (card) {
      setFormData({
        title: card.title,
        clientId: card.contactId || card.clientId || "",
        value: card.value,
        fundingSource: card.fundingSource || "FOND PROPRE",
        responsibleId: card.responsibleId,
        pipelineId: pipeline?.id || "",
        columnId: card.columnId,
        notes: card.notes || "",
        tags: Array.isArray(card.tags) ? card.tags : []
      });
    }
  }, [card, open, pipeline]);

  const toggleTag = (tagValue) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagValue)
        ? prev.tags.filter(t => t !== tagValue)
        : [...prev.tags, tagValue]
    }));
  };

  const selectedContact = useMemo(() => 
    state.contacts.find(c => c.id === formData.clientId),
    [state.contacts, formData.clientId]
  );

  const handleLogNote = async () => {
    if (!tempFollowUpNote.trim()) return;
    
    try {
      const now = new Date().toISOString();
      const newEntry = {
        date: now,
        userId: state.currentUser.id,
        action: `Note ajoutée : ${tempFollowUpNote.trim()}`,
        type: 'internal_note',
        content: tempFollowUpNote.trim()
      };

      const updatedCard = {
        ...card,
        history: [newEntry, ...(card.history || [])]
      };

      const savedCard = await db.updateCard(card.id, updatedCard);
      
      dispatch({ 
        type: "UPDATE_PIPELINES", 
        payload: (prev) => prev.map(p => {
          const hasCard = p.columns.some(col => col.cards.some(c => c.id === card.id));
          if (hasCard) {
            return {
              ...p,
              columns: p.columns.map(col => ({
                ...col,
                cards: col.cards.map(c => c.id === card.id ? savedCard : c)
              }))
            };
          }
          return p;
        })
      });
      setTempFollowUpNote("");
      toast.success("Note ajoutée au journal de suivi");
    } catch (error) {
      console.error("Error logging note:", error);
      toast.error("Erreur lors de l'ajout de la note");
    }
  };

  const allActivity = useMemo(() => {
    try {
      if (!card) return [];
      const activities = [];

      // 1. Audit History & Internal Notes from the card itself
      const cardHistory = Array.isArray(card.history) ? card.history : [];
      cardHistory.forEach(h => {
        if (!h || !h.date) return;
        const d = new Date(h.date);
        if (isNaN(d.getTime())) return;
        
        activities.push({
          date: d,
          type: h.type === 'internal_note' ? 'internal_note' : 'audit',
          action: String(h.action || "Action inconnue"),
          content: h.content,
          user: state.users?.find(u => u.id === h.userId)?.name || "Système"
        });
      });

      // 2. Notes from Tasks linked to this card
      const allTasks = Array.isArray(state.tasks) ? state.tasks : [];
      const cardTasks = allTasks.filter(t => t && t.linkedCardId === card.id);
      cardTasks.forEach(t => {
        const taskDateRaw = t.dueDate || t.date;
        if (!taskDateRaw) return;
        const d = new Date(taskDateRaw);
        if (isNaN(d.getTime())) return;
        
        if (t.description || t.notes) {
          activities.push({
            date: d,
            type: 'task_note',
            title: String(t.title || "Tâche"),
            content: String(t.description || t.notes || ""),
            status: t.status,
            user: state.users?.find(u => u.id === t.userId)?.name || "Agent"
          });
        }
      });

      // 3. Interactions from the Contact
      if (selectedContact && Array.isArray(selectedContact.interactions)) {
        selectedContact.interactions.forEach(int => {
          if (!int || !int.date) return;
          const d = new Date(int.date);
          if (isNaN(d.getTime())) return;
          activities.push({
            date: d,
            type: 'interaction',
            subType: String(int.type || "call"),
            content: String(int.content || ""),
            user: state.users?.find(u => u.id === int.userId)?.name || "Agent"
          });
        });
      }

      return activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error("Error in allActivity memo:", error);
      return [];
    }
  }, [card, state.tasks, selectedContact, state.users]);

  if (!card) return null;

  const handleOpenTaskDialog = (task = null) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

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

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Persist to DB
      const updatedDbCard = await db.updateCard(card.id, {
        ...card,
        ...formData,
        contactId: formData.clientId,
      });

      const updatedCard = {
        ...updatedDbCard,
        clientId: updatedDbCard.contactId,
      };

      const updatedPipelines = state.pipelines.map(p => {
        // Source Pipeline (where the card currently is in state)
        if (p.id === pipeline.id) {
          const newColumns = p.columns.map(col => {
            // Remove from old column
            if (col.id === card.columnId) {
              return { ...col, cards: (col.cards || []).filter(c => c.id !== card.id) };
            }
            return col;
          });

          // If source and target are the same, we also need to add/update in this same pipeline object
          if (pipeline.id === formData.pipelineId) {
            return {
              ...p,
              columns: newColumns.map(col => {
                if (col.id === formData.columnId) {
                  const isUpdate = (col.cards || []).find(c => c.id === card.id);
                  if (isUpdate) {
                    return { ...col, cards: col.cards.map(c => c.id === card.id ? updatedCard : c) };
                  } else {
                    return { ...col, cards: [...(col.cards || []), updatedCard] };
                  }
                }
                return col;
              })
            };
          }
          return { ...p, columns: newColumns };
        }

        // Target Pipeline (if different from source)
        if (p.id === formData.pipelineId && pipeline.id !== formData.pipelineId) {
          return {
            ...p,
            columns: p.columns.map(col => {
              if (col.id === formData.columnId) {
                return { ...col, cards: [...(col.cards || []), updatedCard] };
              }
              return col;
            })
          };
        }

        return p;
      });

      dispatch({ 
        type: "UPDATE_PIPELINES", 
        payload: (prev) => prev.map(p => {
          // 1. Remove the card from its old position (wherever it was)
          const newColumns = p.columns.map(col => ({
            ...col,
            cards: col.cards.filter(c => c.id !== card.id)
          }));

          // 2. If this is the target pipeline, add the card to the target column
          if (p.id === formData.pipelineId) {
            return {
              ...p,
              columns: newColumns.map(col => {
                if (col.id === formData.columnId) {
                  return { ...col, cards: [...col.cards, savedCard] };
                }
                return col;
              })
            };
          }

          // 3. Otherwise, just return the pipeline without the card (in case it was there)
          return { ...p, columns: newColumns };
        })
      });
      toast.success("Affaire mise à jour");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving card:", error);
      toast.error("Erreur lors de l'enregistrement de l'affaire");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      const updatedTasks = state.tasks.map(t => t.id === task.id ? { ...t, status: "done" } : t);
      await db.updateTask(task.id, { ...task, status: "done" });
      dispatch({ type: "UPDATE_TASKS", payload: updatedTasks });

      // Audit automatique pour les affaires liées
      const historyEntry = {
        date: new Date().toISOString(),
        userId: state.currentUser.id,
        action: `Action terminée depuis la fiche affaire : ${task.title}`
      };
      const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
      await db.updateCard(card.id, updatedCard);
      await refreshAllData();

      toast.success("Action terminée !");
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async () => {
    try {
      await db.deleteCard(card.id);
      
      dispatch({ 
        type: "UPDATE_PIPELINES", 
        payload: (prev) => prev.map(p => {
          if (p.id === pipeline.id) {
            return {
              ...p,
              columns: p.columns.map(col => ({
                ...col,
                cards: (col.cards || []).filter(c => c.id !== card.id)
              }))
            };
          }
          return p;
        })
      });
      toast.success("Affaire supprimée");
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Erreur lors de la suppression de l'affaire");
    }
  };

  const tasks = state.tasks.filter(t => t.linkedCardId === card.id);
  const contactInteractions = selectedContact?.interactions || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-green-600" />
            {card.title}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Section Infos générales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-[10px] tracking-widest">
                Informations de l'affaire
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Titre de l'affaire *</Label>
                  <Input 
                    value={formData.title} 
                    className="h-9 text-xs border-slate-200 bg-slate-50/50"
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
                        <Check className="ml-2 h-3 w-3 shrink-0 opacity-30" />
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
                                    setFormData(prev => ({ ...prev, clientId: c.id }));
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
                      </Command>                    </PopoverContent>
                  </Popover>

                  {selectedContact && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                      {selectedContact.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium">
                          <Phone className="w-3 h-3" />
                          {selectedContact.phone}
                        </div>
                      )}
                      {selectedContact.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <Mail className="w-3 h-3" />
                          {selectedContact.email}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500 flex items-center gap-1.5">
                      <TagIcon className="w-3 h-3" /> Catégories & Tags
                    </Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {PRESET_TAGS.map(tag => {
                        const isActive = formData.tags.includes(tag.value);
                        return (
                          <Badge 
                            key={tag.value}
                            variant={isActive ? "default" : "outline"}
                            className={`cursor-pointer transition-all h-7 px-3 text-[10px] uppercase font-black tracking-widest ${isActive ? tag.color : 'text-slate-400 border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}
                            onClick={() => toggleTag(tag.value)}
                          >
                            {tag.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Valeur (€)</Label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input 
                        type="number" 
                        className="pl-9 h-9 text-xs border-slate-200 bg-slate-50/50" 
                        value={formData.value} 
                        onChange={e => setFormData({...formData, value: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
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
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Notes Générales / Description</Label>
                    <Textarea 
                      placeholder="Informations permanentes sur cette affaire..." 
                      className="min-h-[60px] bg-slate-50/50 text-xs border-slate-100 focus:bg-white transition-colors"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Pipeline</Label>
                    <Select value={formData.pipelineId} onValueChange={val => {
                      const newPipeline = state.pipelines.find(p => p.id === val);
                      setFormData({
                        ...formData, 
                        pipelineId: val, 
                        columnId: newPipeline?.columns?.[0]?.id || ""
                      });
                    }}>
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
                    <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Étape</Label>
                    <Select value={formData.columnId} onValueChange={val => setFormData({...formData, columnId: val})}>
                      <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {state.pipelines.find(p => p.id === formData.pipelineId)?.columns?.map(col => (
                          <SelectItem key={col.id} value={col.id} className="text-xs">{col.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions liées */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-[10px] tracking-widest">
                  Actions & Tâches ({tasks.length})
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleOpenTaskDialog()}
                >
                  <Plus className="w-3 h-3 mr-1" /> Ajouter une action
                </Button>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Aucune action planifiée.</p>
                ) : (
                  tasks
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border group cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0" onClick={() => handleOpenTaskDialog(task)}>
                        <div className="flex items-center gap-2">
                          <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${task.status === 'done' ? 'text-green-500' : 'text-slate-300'}`} />
                          <p className={`text-xs font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                            {task.title}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 ml-5">
                          {format(new Date(task.date), "dd MMM")} à {task.time}
                        </p>
                      </div>
                      {task.status !== 'done' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity p-0 hover:bg-green-50"
                          onClick={() => handleCompleteTask(task)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Ajouter une note de suivi</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[9px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={handleLogNote}
                  disabled={!tempFollowUpNote.trim()}
                >
                  <StickyNote className="w-3 h-3 mr-1" /> ENREGISTRER LA NOTE
                </Button>
              </div>
              <Textarea 
                placeholder="Écrivez un commentaire ou une note ici..." 
                className="min-h-[80px] bg-slate-50/50 text-xs border-slate-100 focus:bg-white transition-colors"
                value={tempFollowUpNote}
                onChange={e => setTempFollowUpNote(e.target.value)}
              />
              <p className="text-[9px] text-slate-400 italic">La note sera archivée chronologiquement dans le journal ci-dessous.</p>
            </div>

            <Separator />

            {/* Historique & Activité Client */}
            <div className="space-y-4 pb-4">
              <Tabs defaultValue="journal" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-100/50 h-9 p-1 rounded-lg">
                  <TabsTrigger value="journal" className="text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-700">Journal & Suivi</TabsTrigger>
                  <TabsTrigger value="history" className="text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-white data-[state=active]:text-green-700">Audit</TabsTrigger>
                  <TabsTrigger value="interactions" className="text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-700">Client</TabsTrigger>
                </TabsList>
                
                <TabsContent value="journal" className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {allActivity.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 italic">Aucune note ou activité enregistrée.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pl-4 border-l-2 border-slate-100">
                      {allActivity.map((act, i) => (
                        <div key={i} className="text-[11px] relative">
                          <div className={`absolute -left-[21px] top-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                            act.type === 'audit' ? 'bg-slate-400' : 
                            act.type === 'task_note' ? 'bg-indigo-500' : 
                            act.type === 'internal_note' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-slate-900">{format(act.date, "dd MMM yyyy HH:mm", { locale: fr })}</span>
                            <Badge variant="ghost" className="h-4 px-1 text-[8px] uppercase font-bold opacity-60">Par {act.user}</Badge>
                          </div>

                          {act.type === 'audit' && (
                            <p className="text-slate-600 font-medium italic">{act.action}</p>
                          )}

                          {act.type === 'internal_note' && (
                            <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                              <p className="font-bold text-amber-700 flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-tight">
                                <StickyNote className="w-3 h-3" /> NOTE INTERNE
                              </p>
                              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{act.content}</p>
                            </div>
                          )}

                          {act.type === 'task_note' && (
                            <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50">
                              <p className="font-bold text-indigo-700 flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-tight">
                                <CheckSquare className="w-3 h-3" /> NOTE DE TÂCHE : {act.title}
                              </p>
                              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">"{act.content}"</p>
                            </div>
                          )}

                          {act.type === 'interaction' && (
                            <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                              <p className="font-bold text-blue-700 flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-tight">
                                {act.subType === 'call' ? '📞 APPEL' : '📧 EMAIL'}
                              </p>
                              <p className="text-slate-700 italic">"{act.content}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                    {(card.history || []).map((h, i) => (
                      <div key={i} className="text-[11px] relative">
                        <div className="absolute -left-[21px] top-0.5 w-3 h-3 rounded-full bg-slate-200 border-2 border-white shadow-sm" />
                        <span className="font-bold text-slate-900">{format(new Date(h.date), "dd/MM HH:mm")}</span> — {h.action}
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Par {state.users.find(u => u.id === h.userId)?.name || "Système"}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="interactions" className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {contactInteractions.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 italic">Aucune interaction consignée pour ce client.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pl-4 border-l-2 border-blue-50">
                      {contactInteractions.slice(0, 10).map((int, i) => (
                        <div key={i} className="text-[11px] relative">
                          <div className="absolute -left-[21px] top-0.5 bg-white p-0.5 rounded-full ring-2 ring-blue-50">
                            <CheckCircle2 className="w-3 h-3 text-blue-500" />
                          </div>
                          <p className="font-bold text-slate-900">
                            {format(new Date(int.date), "dd/MM HH:mm")} — {int.type === 'call' ? '📞 Appel' : '📧 Email'}
                          </p>
                          <div className="bg-blue-50/30 p-2 rounded-lg mt-1 border border-blue-50/50">
                            <p className="text-slate-600 italic">"{int.content}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 border-t bg-white gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="w-4 h-4 mr-2" /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette affaire ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible. Toutes les données liées seront perdues.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700">Enregistrer</Button>
        </SheetFooter>
      </SheetContent>

      <TaskDialog 
        task={selectedTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        defaultContactId={formData.clientId}
        defaultCardId={card.id}
      />

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
    </Sheet>
  );
}
