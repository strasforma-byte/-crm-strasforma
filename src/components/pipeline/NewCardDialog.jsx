import React, { useState, useEffect } from "react";
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
import { CheckSquare, Calendar as CalendarIcon, Building2, User as UserIcon, Euro } from "lucide-react";

export default function NewCardDialog({ open, onOpenChange, defaultPipelineId, defaultContactId }) {
  const { state, dispatch } = useApp();
  
  const [formData, setFormData] = useState({
    title: "",
    clientId: "",
    value: "",
    pipelineId: defaultPipelineId || "",
    columnId: "",
    responsibleId: state.currentUser?.id || ""
  });

  const [createTask, setCreateTask] = useState(false);
  const [taskData, setTaskData] = useState({
    title: "Appel de découverte",
    type: "call",
    date: new Date(),
    time: "09:00",
    duration: "30"
  });

  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "" });

  useEffect(() => {
    if (open) {
      const pipeId = defaultPipelineId || state.pipelines[0]?.id;
      const pipeline = state.pipelines.find(p => p.id === pipeId);
      setFormData({
        title: "",
        clientId: defaultContactId || state.contacts[0]?.id || "",
        value: "",
        pipelineId: pipeId,
        columnId: pipeline?.columns[0]?.id || "",
        responsibleId: state.currentUser?.id || ""
      });
      setCreateTask(false);
      setTaskData({
        title: "Appel de découverte",
        type: "call",
        date: new Date(),
        time: "09:00",
        duration: "30"
      });
    }
  }, [open, defaultPipelineId, defaultContactId, state.pipelines, state.contacts, state.currentUser]);

  const handleQuickContactCreate = () => {
    if (!quickContact.firstName || !quickContact.lastName || !quickContact.email) {
      toast.error("Veuillez remplir les champs du contact");
      return;
    }
    const newContact = {
      id: "c" + (state.contacts.length + 1),
      createdBy: state.currentUser.id,
      listId: "list-default",
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

  const handlePipelineChange = (pipeId) => {
    const pipeline = state.pipelines.find(p => p.id === pipeId);
    setFormData({
      ...formData,
      pipelineId: pipeId,
      columnId: pipeline?.columns[0]?.id || ""
    });
  };

  const handleCreate = () => {
    if (!formData.title || !formData.clientId || !formData.pipelineId || !formData.columnId) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (createTask && !taskData.title) {
      toast.error("Veuillez donner un titre à la tâche");
      return;
    }

    const cardId = "card-" + Date.now();
    const newCard = {
      id: cardId,
      title: formData.title,
      clientId: formData.clientId,
      value: parseInt(formData.value) || 0,
      responsibleId: formData.responsibleId,
      pipelineId: formData.pipelineId,
      columnId: formData.columnId,
      notes: "",
      history: [{ date: new Date().toISOString(), userId: state.currentUser.id, action: "Affaire créée" }],
      taskIds: []
    };

    let actionDateForCard = null;

    if (createTask) {
      const taskDate = new Date(taskData.date);
      const [h, m] = taskData.time.split(":").map(Number);
      taskDate.setHours(h, m);
      actionDateForCard = taskDate;

      const newTask = {
        id: "t" + Date.now(),
        userId: formData.responsibleId,
        title: taskData.title,
        type: taskData.type,
        date: format(taskDate, "yyyy-MM-dd"),
        time: taskData.time,
        duration: parseInt(taskData.duration) || 30,
        linkedContactId: formData.clientId,
        linkedCardId: cardId,
        status: "pending",
        notes: ""
      };
      dispatch({ type: "UPDATE_TASKS", payload: [...state.tasks, newTask] });
    }

    newCard.nextAction = createTask ? taskData.title : "";
    newCard.nextActionDate = actionDateForCard ? actionDateForCard.toISOString() : null;

    const updatedPipelines = state.pipelines.map(p => {
      if (p.id === formData.pipelineId) {
        return {
          ...p,
          columns: p.columns.map(col => {
            if (col.id === formData.columnId) {
              return { ...col, cards: [newCard, ...col.cards] };
            }
            return col;
          })
        };
      }
      return p;
    });

    dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
    toast.success("Affaire créée avec succès");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle Affaire</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 py-4">
          <div className="col-span-2 space-y-2">
            <Label>Titre de l'affaire *</Label>
            <Input 
              placeholder="Ex: Refonte Site Web" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div className="space-y-2">
            <Label className="flex justify-between items-center">
              <span>Client lié *</span>
              <Button variant="ghost" className="h-5 px-1 text-[10px] text-green-600 hover:bg-green-50" onClick={() => setIsQuickContactOpen(true)}>
                + Nouveau contact
              </Button>
            </Label>
            <Select value={formData.clientId} onValueChange={val => setFormData({...formData, clientId: val})}>
              <SelectTrigger>
                <div className="flex items-center gap-2 overflow-hidden">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
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

          <div className="space-y-2">
            <Label>Valeur (€)</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="number" 
                className="pl-10" 
                value={formData.value} 
                onChange={e => setFormData({...formData, value: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pipeline *</Label>
            <Select value={formData.pipelineId} onValueChange={handlePipelineChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Étape *</Label>
            <Select value={formData.columnId} onValueChange={val => setFormData({...formData, columnId: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.pipelines.find(p => p.id === formData.pipelineId)?.columns.map(col => (
                  <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Responsable</Label>
            <Select value={formData.responsibleId} onValueChange={val => setFormData({...formData, responsibleId: val})}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {state.users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 pt-4 border-t">
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <Label className="font-bold text-sm">Créer une tâche liée</Label>
                  <p className="text-xs text-slate-500">Planifier immédiatement la prochaine action</p>
                </div>
              </div>
              <Switch checked={createTask} onCheckedChange={setCreateTask} />
            </div>
          </div>

          {createTask && (
            <>
              <div className="col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Titre de la tâche</Label>
                <Input 
                  placeholder="Ex: Appel de qualification" 
                  value={taskData.title} 
                  onChange={e => setTaskData({...taskData, title: e.target.value})} 
                />
              </div>

              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Type</Label>
                <Select value={taskData.type} onValueChange={val => setTaskData({...taskData, type: val})}>
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

              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                      {format(taskData.date, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={taskData.date}
                      onSelect={date => setTaskData({...taskData, date: date || new Date()})}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Heure</Label>
                <Input 
                  type="time" 
                  value={taskData.time} 
                  onChange={e => setTaskData({...taskData, time: e.target.value})} 
                />
              </div>

              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Durée (min)</Label>
                <Select value={taskData.duration} onValueChange={val => setTaskData({...taskData, duration: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1h</SelectItem>
                    <SelectItem value="120">2h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleCreate}>Créer l'affaire</Button>
        </DialogFooter>
      </DialogContent>

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
    </Dialog>
  );
}
