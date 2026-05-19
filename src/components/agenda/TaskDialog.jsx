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
import { Calendar as CalendarIcon, Clock, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

  const handleSave = () => {
    if (!formData.title) {
      toast.error("Veuillez entrer un titre");
      return;
    }

    const taskData = {
      ...formData,
      id: task?.id || "t" + Date.now(),
      date: format(formData.date, "yyyy-MM-dd"),
      linkedContactId: formData.linkedContactId === "none" ? null : formData.linkedContactId,
      linkedCardId: formData.linkedCardId === "none" ? null : formData.linkedCardId,
    };

    if (task) {
      const updated = state.tasks.map(t => t.id === task.id ? taskData : t);
      dispatch({ type: "UPDATE_TASKS", payload: updated });
      toast.success("Tâche mise à jour");
    } else {
      dispatch({ type: "UPDATE_TASKS", payload: [...state.tasks, taskData] });
      toast.success("Tâche créée");
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    const updated = state.tasks.filter(t => t.id !== task.id);
    dispatch({ type: "UPDATE_TASKS", payload: updated });
    toast.success("Tâche supprimée");
    onOpenChange(false);
  };

  const handleToggleStatus = () => {
    const newStatus = formData.status === "done" ? "pending" : "done";
    setFormData({...formData, status: newStatus});
    if (task) {
      const updated = state.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
      dispatch({ type: "UPDATE_TASKS", payload: updated });
      toast.success(newStatus === "done" ? "Tâche terminée !" : "Tâche réouverte");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 space-y-2">
            <Label>Titre</Label>
            <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Rappeler client" />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
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
            <Label>Durée (min)</Label>
            <Select value={formData.duration} onValueChange={val => setFormData({...formData, duration: val})}>
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

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
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

          <div className="space-y-2">
            <Label>Heure</Label>
            <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
          </div>

          <div className="space-y-2">
            <Label>Contact lié</Label>
            <Select value={formData.linkedContactId} onValueChange={val => setFormData({...formData, linkedContactId: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {state.contacts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Affaire liée</Label>
            <Select value={formData.linkedCardId} onValueChange={val => setFormData({...formData, linkedCardId: val})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {state.pipelines.flatMap(p => p.columns.flatMap(col => col.cards)).map(card => (
                  <SelectItem key={card.id} value={card.id}>{card.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className="col-span-2 space-y-2">
              <Label>Assigné à</Label>
              <Select value={formData.userId} onValueChange={val => setFormData({...formData, userId: val})}>
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
          )}

          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea 
              className="min-h-[100px]" 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {task && (
              <Button variant="outline" size="icon" className="text-red-600 hover:bg-red-50" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {task && (
              <Button variant="outline" className={formData.status === 'done' ? 'text-blue-600' : 'text-green-600'} onClick={handleToggleStatus}>
                <Check className="w-4 h-4 mr-2" />
                {formData.status === 'done' ? "Réouvrir" : "Terminer"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave}>Enregistrer</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
