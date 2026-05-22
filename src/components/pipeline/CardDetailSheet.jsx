import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CheckSquare, 
  Plus, 
  Trash2, 
  User as UserIcon,
  Briefcase,
  Building2,
  Euro,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Fingerprint
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

export default function CardDetailSheet({ card, pipeline, open, onOpenChange }) {
  const { state, dispatch } = useApp();
  
  const [formData, setFormData] = useState({
    title: "",
    clientId: "",
    value: 0,
    responsibleId: "",
    columnId: "",
    nextAction: "",
    nextActionType: "call",
    nextActionDate: null,
    nextActionTime: "09:00",
    notes: ""
  });

  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    if (card) {
      setFormData({
        title: card.title,
        clientId: card.contactId || card.clientId || "",
        value: card.value,
        responsibleId: card.responsibleId,
        columnId: card.columnId,
        nextAction: card.nextAction || "",
        nextActionType: card.nextActionType || "call",
        nextActionDate: card.nextActionDate ? new Date(card.nextActionDate) : null,
        nextActionTime: card.nextActionDate ? format(new Date(card.nextActionDate), "HH:mm") : "09:00",
        notes: card.notes || ""
      });
    }
  }, [card, open]);

  const selectedContact = useMemo(() => 
    state.contacts.find(c => c.id === formData.clientId),
    [state.contacts, formData.clientId]
  );

  if (!card) return null;

  const handleOpenTaskDialog = (task = null) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

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
      setFormData({ ...formData, clientId: savedContact.id });
      setIsQuickContactOpen(false);
      setQuickContact({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
      toast.success("Contact créé et sélectionné");
    } catch (error) {
      toast.error("Erreur lors de la création du contact");
    }
  };

  const handleSave = async () => {
    const updatedDate = formData.nextActionDate;
    if (updatedDate) {
      const [hours, minutes] = formData.nextActionTime.split(":").map(Number);
      updatedDate.setHours(hours, minutes);
    }

    try {
      // Persist to DB
      const updatedDbCard = await db.updateCard(card.id, {
        ...card,
        ...formData,
        nextActionDate: updatedDate ? updatedDate.toISOString() : null,
      });

      // Map DB response to local state structure
      const updatedCard = {
        ...card,
        ...formData,
        contactId: updatedDbCard.contact_id, // Map database field
        clientId: updatedDbCard.contact_id,  // Fallback for UI sync
        nextActionDate: updatedDate ? updatedDate.toISOString() : null,
        history: [
          { date: new Date().toISOString(), userId: state.currentUser.id, action: "Affaire modifiée" },
          ...(card.history || [])
        ]
      };

      const updatedPipelines = state.pipelines.map(p => {
        if (p.id === pipeline.id) {
          return {
            ...p,
            columns: p.columns.map(col => {
              // Remove from old column if changed
              if (col.id === card.columnId && col.id !== formData.columnId) {
                return { ...col, cards: (col.cards || []).filter(c => c.id !== card.id) };
              }
              // Add to new column or update in same
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
        return p;
      });

      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
      toast.success("Affaire mise à jour");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving card:", error);
      toast.error("Erreur lors de l'enregistrement de l'affaire");
    }
  };

  const handleDelete = () => {
    const updatedPipelines = state.pipelines.map(p => {
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
    });
    dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
    toast.success("Affaire supprimée");
    onOpenChange(false);
  };

  const tasks = state.tasks.filter(t => t.linkedCardId === card.id);

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
                                    setFormData({ ...formData, clientId: c.id });
                                    setIsClientSearchOpen(false);
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Étape du pipeline</Label>
                  <Select value={formData.columnId} onValueChange={val => setFormData({...formData, columnId: val})}>
                    <SelectTrigger className="h-9 text-xs border-slate-200 bg-slate-50/50 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pipeline.columns.map(col => (
                        <SelectItem key={col.id} value={col.id} className="text-xs">{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Prochaine Action */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-[10px] tracking-widest">
                Prochaine Action
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Type d'action</Label>
                  <Select value={formData.nextActionType} onValueChange={val => setFormData({...formData, nextActionType: val})}>
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
                  <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Description</Label>
                  <Input 
                    value={formData.nextAction} 
                    className="h-9 text-xs border-slate-200 bg-slate-50/50"
                    onChange={e => setFormData({...formData, nextAction: e.target.value})} 
                    placeholder="Ex: Envoyer le contrat" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase font-black tracking-wider text-slate-500">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-9 justify-start text-left font-medium text-xs border-slate-200 bg-slate-50/50">
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                          {formData.nextActionDate ? format(formData.nextActionDate, "dd/MM/yyyy") : "Choisir une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.nextActionDate}
                          onSelect={date => setFormData({...formData, nextActionDate: date})}
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
                      value={formData.nextActionTime} 
                      onChange={e => setFormData({...formData, nextActionTime: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Tâches liées */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-[10px] tracking-widest">
                  Tâches liées ({tasks.length})
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleOpenTaskDialog()}
                >
                  <Plus className="w-3 h-3 mr-1" /> Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Aucune tâche planifiée</p>
                ) : (
                  tasks.map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border group cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleOpenTaskDialog(task)}
                    >
                      <CheckSquare className={`w-4 h-4 shrink-0 ${task.status === 'done' ? 'text-green-500' : 'text-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {format(new Date(task.date), "dd MMM")} à {task.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-bold tracking-widest">Notes internes</Label>
              <Textarea 
                placeholder="Détails supplémentaires..." 
                className="min-h-[150px] bg-slate-50/50 text-xs"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>

            {/* Historique */}
            <div className="space-y-4 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-[10px] tracking-widest">
                Historique
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                {(card.history || []).map((h, i) => (
                  <div key={i} className="text-[11px]">
                    <span className="font-bold">{format(new Date(h.date), "dd/MM HH:mm")}</span> — {h.action} par <span className="text-green-600 font-bold">{state.users.find(u => u.id === h.userId)?.name}</span>
                  </div>
                ))}
              </div>
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
        defaultContactId={card.clientId}
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
            <Button className="bg-green-600" onClick={handleQuickContactCreate}>Créer et sélectionner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
