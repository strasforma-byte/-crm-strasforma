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
  CheckSquare, 
  Calendar as CalendarIcon, 
  Building2, 
  User as UserIcon, 
  Euro, 
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
  const [quickContact, setQuickContact] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "", siret: "" });
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const pipeId = defaultPipelineId || (state.pipelines && state.pipelines[0]?.id) || "";
      const pipeline = state.pipelines?.find(p => p.id === pipeId);
      setFormData({
        title: "",
        clientId: defaultContactId || "",
        value: "",
        pipelineId: pipeId,
        columnId: (pipeline && pipeline.columns && pipeline.columns[0]?.id) || "",
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
  }, [open, defaultPipelineId, defaultContactId, state.pipelines, state.currentUser]);

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

    if (createTask && !taskData.title) {
      toast.error("Veuillez donner un titre à la tâche");
      return;
    }

    try {
      const newCardData = {
        columnId: formData.columnId,
        contactId: formData.clientId,
        title: formData.title,
        value: parseFloat(formData.value) || 0,
        priority: "medium",
        tags: [],
        order: 0 
      };

      const savedCard = await db.insertCard(newCardData);
      
      const updatedPipelines = state.pipelines.map(p => {
        if (p.id === formData.pipelineId) {
          return {
            ...p,
            columns: p.columns.map(col => {
              if (col.id === formData.columnId) {
                const updatedCol = { ...col, cards: [...(col.cards || []), {
                  id: savedCard.id,
                  title: savedCard.title,
                  value: savedCard.value,
                  priority: savedCard.priority,
                  tags: savedCard.tags || [],
                  order: savedCard.order,
                  contactId: savedCard.contact_id
                }] };
                return updatedCol;
              }
              return col;
            })
          };
        }
        return p;
      });

      if (createTask) {
        const taskDate = new Date(taskData.date);
        const [h, m] = taskData.time.split(":").map(Number);
        taskDate.setHours(h, m);

        const newTaskData = {
          title: taskData.title,
          description: `Tâche liée à l'affaire: ${formData.title}`,
          dueDate: taskDate.toISOString(),
          status: "pending",
          assignedTo: formData.responsibleId,
          contactId: formData.clientId
        };
        const savedTask = await db.insertTask(newTaskData);
        dispatch({ type: "UPDATE_TASKS", payload: [...state.tasks, savedTask] });
      }

      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
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
            {/* ... Client Popover stays as updated ... */}
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
                {state.pipelines.find(p => p.id === formData.pipelineId)?.columns.map(col => (
                  <SelectItem key={col.id} value={col.id} className="text-xs">{col.name}</SelectItem>
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
