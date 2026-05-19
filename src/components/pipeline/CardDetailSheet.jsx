import React, { useState, useEffect } from "react";
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
  History, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Clock, 
  User as UserIcon,
  Briefcase,
  Building2,
  Euro,
  Calendar as CalendarIcon
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
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
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "" });
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    if (card) {
      setFormData({
        title: card.title,
        clientId: card.clientId,
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

  if (!card) return null;

  const handleOpenTaskDialog = (task = null) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleQuickContactCreate = () => {
    if (!quickContact.firstName || !quickContact.lastName || !quickContact.email) {
      toast.error("Veuillez remplir les champs du contact");
      return;
    }
    const newContact = {
      id: "c" + (state.contacts.length + 1),
      createdBy: state.currentUser.id,
      ...quickContact,
      phone: "",
      tags: ["prospect"],
      interactions: [],
      createdAt: new Date().toISOString()
    };
    dispatch({ type: "UPDATE_CONTACTS", payload: [...state.contacts, newContact] });
    setFormData({ ...formData, clientId: newContact.id });
    setIsQuickContactOpen(false);
    setQuickContact({ firstName: "", lastName: "", company: "", email: "" });
    toast.success("Contact créé et sélectionné");
  };

  const handleSave = () => {
    const updatedDate = formData.nextActionDate;
    if (updatedDate) {
      const [hours, minutes] = formData.nextActionTime.split(":").map(Number);
      updatedDate.setHours(hours, minutes);
    }

    const updatedCard = {
      ...card,
      ...formData,
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
              return { ...col, cards: col.cards.filter(c => c.id !== card.id) };
            }
            // Add to new column or update in same
            if (col.id === formData.columnId) {
              const isUpdate = col.cards.find(c => c.id === card.id);
              if (isUpdate) {
                return { ...col, cards: col.cards.map(c => c.id === card.id ? updatedCard : c) };
              } else {
                return { ...col, cards: [...col.cards, updatedCard] };
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
  };

  const handleDelete = () => {
    const updatedPipelines = state.pipelines.map(p => {
      if (p.id === pipeline.id) {
        return {
          ...p,
          columns: p.columns.map(col => ({
            ...col,
            cards: col.cards.filter(c => c.id !== card.id)
          }))
        };
      }
      return p;
    });
    dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
    toast.success("Affaire supprimée");
    onOpenChange(false);
  };

  const linkedContact = state.contacts.find(c => c.id === formData.clientId);
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
                <div className="space-y-2">
                  <Label>Titre de l'affaire</Label>
                  <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex justify-between items-center">
                    <span>Client lié</span>
                    <Button variant="ghost" className="h-5 px-1 text-[10px] text-green-600 hover:bg-green-50" onClick={() => setIsQuickContactOpen(true)}>
                      + Nouveau contact
                    </Button>
                  </Label>
                  <Select value={formData.clientId} onValueChange={val => setFormData({...formData, clientId: val})}>
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {state.contacts.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.company})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valeur (€)</Label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="number" className="pl-10" value={formData.value} onChange={e => setFormData({...formData, value: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsable</Label>
                    <Select value={formData.responsibleId} onValueChange={val => setFormData({...formData, responsibleId: val})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {state.users.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Étape du pipeline</Label>
                  <Select value={formData.columnId} onValueChange={val => setFormData({...formData, columnId: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pipeline.columns.map(col => (
                        <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
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
                <div className="space-y-2">
                  <Label>Type d'action</Label>
                  <Select value={formData.nextActionType} onValueChange={val => setFormData({...formData, nextActionType: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">📞 Appel</SelectItem>
                      <SelectItem value="email">📧 Email</SelectItem>
                      <SelectItem value="meeting">🤝 RDV</SelectItem>
                      <SelectItem value="relance">🔔 Relance</SelectItem>
                      <SelectItem value="other">📌 Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={formData.nextAction} onChange={e => setFormData({...formData, nextAction: e.target.value})} placeholder="Ex: Envoyer le contrat" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
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
                  <div className="space-y-2">
                    <Label>Heure</Label>
                    <Input type="time" value={formData.nextActionTime} onChange={e => setFormData({...formData, nextActionTime: e.target.value})} />
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
                className="min-h-[150px] bg-slate-50/50"
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
                {card.history?.map((h, i) => (
                  <div key={i} className="text-[11px]">
                    <span className="font-bold">{format(new Date(h.date), "dd/MM HH:mm")}</span> — {h.action} par <span className="text-green-600">{state.users.find(u => u.id === h.userId)?.name}</span>
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

      {/* Task Dialog */}
      <TaskDialog 
        task={selectedTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        // Prefill contact and card when creating a new task from here
        defaultContactId={card.clientId}
        defaultCardId={card.id}
      />

      {/* Quick Contact Dialog */}
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
                <Label>Nom</Label>
                <Input value={quickContact.lastName} onChange={e => setQuickContact({...quickContact, lastName: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Input value={quickContact.company} onChange={e => setQuickContact({...quickContact, company: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={quickContact.email} onChange={e => setQuickContact({...quickContact, email: e.target.value})} />
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
