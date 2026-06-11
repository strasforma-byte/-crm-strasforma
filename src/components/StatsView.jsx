import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  BarChart3, 
  Handshake, 
  TrendingUp, 
  Euro, 
  Clock,
  Calendar,
  Users,
  Target,
  History,
  Download
} from "lucide-react";
import { 
  startOfToday, 
  startOfWeek, 
  startOfMonth, 
  startOfYear, 
  isWithinInterval, 
  endOfToday,
  formatDistanceToNow,
  format
} from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export default function StatsView() {
  const { state } = useApp();
  const [period, setPeriod] = useState("all");
  const [agentId, setAgentId] = useState("all");

  const stats = useMemo(() => {
    try {
      const now = new Date();
      let interval = { start: new Date(0), end: now };

      if (period === "today") interval = { start: startOfToday(), end: endOfToday() };
      if (period === "week") interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
      if (period === "month") interval = { start: startOfMonth(now), end: now };
      if (period === "year") interval = { start: startOfYear(now), end: now };

      const pipelines = Array.isArray(state?.pipelines) ? state.pipelines : [];
      const allTasks = Array.isArray(state?.tasks) ? state.tasks : [];
      
      let deals = pipelines.flatMap(p => (p.columns || []).flatMap(col => col.cards || []));
      
      if (agentId !== "all") {
        deals = deals.filter(d => d.responsibleId === agentId);
      }

      const filteredDeals = deals.filter(d => {
        if (period === "all") return true;
        const creationDate = d.history?.[d.history?.length - 1]?.date;
        if (!creationDate) return true;
        const dateObj = new Date(creationDate);
        if (isNaN(dateObj.getTime())) return true;
        try {
          return isWithinInterval(dateObj, interval);
        } catch (err) { return true; }
      });

      const wonDeals = filteredDeals.filter(c => {
        const pipe = pipelines.find(p => p.id === c.pipelineId);
        const col = pipe?.columns?.find(col => col.id === c.columnId);
        const colName = (col?.name || "").toLowerCase();
        return colName.includes("gagné") || colName.includes("won");
      });

      const totalWonValue = wonDeals.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
      const avgWonValue = wonDeals.length > 0 ? Math.round(totalWonValue / wonDeals.length) : 0;

      let tasks = allTasks;
      if (agentId !== "all") tasks = tasks.filter(t => t.userId === agentId);
      if (period !== "all") {
        tasks = tasks.filter(t => {
          if (!t.date) return false;
          const dateObj = new Date(t.date);
          if (isNaN(dateObj.getTime())) return false;
          try {
            return isWithinInterval(dateObj, interval);
          } catch (err) { return false; }
        });
      }

      const meetings = tasks.filter(t => t.type === "meeting");
      const meetingsDone = meetings.filter(t => t.status === "done");

      const conversionRate = filteredDeals.length > 0 
        ? Math.round((wonDeals.length / filteredDeals.length) * 100) 
        : 0;

      return {
        totalWonValue,
        wonCount: wonDeals.length,
        avgWonValue,
        meetingsCount: meetings.length,
        meetingsDoneCount: meetingsDone.length,
        conversionRate,
        activeDealsCount: filteredDeals.length - wonDeals.length,
        totalCount: filteredDeals.length,
        filteredTasks: tasks // Expose pour les compteurs
      };
    } catch (e) {
      return { totalWonValue: 0, wonCount: 0, avgWonValue: 0, meetingsCount: 0, meetingsDoneCount: 0, conversionRate: 0, activeDealsCount: 0, totalCount: 0 };
    }
  }, [state, period, agentId]);

  const recentActivity = useMemo(() => {
    const pipelines = Array.isArray(state?.pipelines) ? state.pipelines : [];
    const allDeals = pipelines.flatMap(p => (p.columns || []).flatMap(col => col.cards || []));
    
    let activities = allDeals.flatMap(deal => 
      (deal.history || []).map(h => ({
        ...h,
        dealTitle: deal.title,
        dealId: deal.id
      }))
    );

    if (agentId !== "all") {
      activities = activities.filter(a => a.userId === agentId);
    }

    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15);
  }, [state.pipelines, agentId]);

  const agentPerformance = useMemo(() => {
    const pipelines = Array.isArray(state?.pipelines) ? state.pipelines : [];
    const allCards = pipelines.flatMap(p => (p.columns || []).flatMap(col => col.cards || []));
    const allTasks = Array.isArray(state?.tasks) ? state.tasks : [];

    return state.users.map(u => {
      const userDeals = allCards.filter(c => c.responsibleId === u.id);
      const wonDeals = userDeals.filter(c => c.columnId?.toLowerCase().includes("gagné") || c.columnId?.toLowerCase().includes("won"));
      const totalWonValue = wonDeals.reduce((sum, c) => sum + (c.value || 0), 0);
      const pendingTasks = allTasks.filter(t => t.userId === u.id && t.status !== "done").length;

      return {
        ...u,
        wonCount: wonDeals.length,
        totalWonValue,
        pendingTasks
      };
    }).sort((a, b) => b.totalWonValue - a.totalWonValue);
  }, [state.users, state.pipelines, state.tasks]);

  const handleExportReport = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // 1. Sheet KPIs Globaux
      const kpiData = [
        { Indicateur: "Taux de Closing", Valeur: `${stats.conversionRate}%` },
        { Indicateur: "Panier Moyen", Valeur: `${stats.avgWonValue} €` },
        { Indicateur: "Affaires Gagnées", Valeur: stats.wonCount },
        { Indicateur: "Volume Total Gagné", Valeur: `${stats.totalWonValue} €` },
        { Indicateur: "Affaires Actives", Valeur: stats.activeDealsCount },
        { Indicateur: "RDV Honorés", Valeur: `${stats.meetingsDoneCount} / ${stats.meetingsCount}` }
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(kpiData), "KPIs Globaux");

      // 2. Sheet Classement Équipe
      const teamData = agentPerformance.map(a => ({
        Agent: a.name,
        Rôle: a.role,
        "Affaires Gagnées": a.wonCount,
        "Volume (€)": a.totalWonValue,
        "Tâches en cours": a.pendingTasks
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamData), "Classement Équipe");

      // 3. Sheet Flux d'Activité
      const activityData = recentActivity.map(act => ({
        Date: format(new Date(act.date), "dd/MM/yyyy HH:mm"),
        Agent: state.users.find(u => u.id === act.userId)?.name || "Système",
        Action: act.action,
        Affaire: act.dealTitle
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(activityData), "Flux d'Activité");

      const fileName = `crm-rapport-performance-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Rapport de performance généré !");
    } catch (error) {
      console.error("Report export error:", error);
      toast.error("Erreur lors de la génération du rapport");
    }
  };

  const safeUsers = Array.isArray(state?.users) ? state.users : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Statistiques</h2>
          <p className="text-sm text-slate-500">Visualisez les performances de votre activité</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportReport} className="h-10 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 mr-2" /> Rapport Excel
          </Button>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] bg-slate-50 border-none">
              <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>

          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-[140px] bg-slate-50 border-none">
              <Users className="w-3.5 h-3.5 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Équipe</SelectItem>
              {safeUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase">Ventes</p>
            <h3 className="text-2xl font-black">{stats.totalWonValue.toLocaleString()} €</h3>
            <Badge variant="secondary" className="mt-2 text-[10px] bg-green-50 text-green-700">{stats.wonCount} deals</Badge>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase">Conversion</p>
            <h3 className="text-2xl font-black">{stats.conversionRate}%</h3>
            <p className="text-[10px] text-slate-400 mt-2">Taux de signature</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase">RDV Effectués</p>
            <h3 className="text-2xl font-black">{stats.meetingsDoneCount} / {stats.meetingsCount}</h3>
            <Progress value={stats.meetingsCount > 0 ? (stats.meetingsDoneCount / stats.meetingsCount) * 100 : 0} className="h-1 mt-3" />
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase">Panier Moyen</p>
            <h3 className="text-2xl font-black">{stats.avgWonValue.toLocaleString()} €</h3>
            <div className="mt-2 p-1 bg-orange-50 rounded inline-block">
              <Target className="w-3.5 h-3.5 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Performance Agents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {safeUsers.map(user => {
              const userDeals = (Array.isArray(state?.pipelines) ? state.pipelines : []).flatMap(p => 
                (p.columns || []).flatMap(col => 
                  (col.cards || []).filter(c => c.responsibleId === user.id)
                )
              );
              const userWon = userDeals.filter(c => {
                const pipe = state.pipelines.find(p => p.id === c.pipelineId);
                const col = pipe?.columns?.find(col => col.id === c.columnId);
                return (col?.name || "").toLowerCase().includes("gagné");
              });
              const wonValue = userWon.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
              const pct = userDeals.length > 0 ? Math.round((userWon.length / userDeals.length) * 100) : 0;

              return (
                <div key={user.id} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: user.color }} />
                      <span className="font-bold">{user.name}</span>
                    </div>
                    <span className="font-bold">{wonValue.toLocaleString()} €</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Activités du groupe</CardTitle>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                {period === "all" ? "Toute la période" : `Période : ${period}`}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { type: 'call', label: 'Appels', color: 'bg-blue-500' },
                { type: 'meeting', label: 'RDV', color: 'bg-green-500' },
                { type: 'email', label: 'Emails', color: 'bg-purple-500' },
                { type: 'relance', label: 'Relances', color: 'bg-orange-500' },
                { type: 'formation', label: 'Formations', color: 'bg-cyan-500' },
              ].map(item => {
                const count = (stats.filteredTasks || []).filter(t => t.type === item.type).length;
                const totalEver = (Array.isArray(state?.tasks) ? state.tasks : []).filter(t => t.type === item.type).length;
                
                return (
                  <div key={item.type} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.color} shadow-sm`} />
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-slate-900 text-[10px] h-5 min-w-[24px] flex justify-center text-white">{count}</Badge>
                      <span className="text-[9px] text-slate-400 font-bold">/ {totalEver}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold">Flux d'activité</CardTitle>
              <History className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">Aucune activité récente</p>
                ) : (
                  recentActivity.map((act, i) => {
                    const user = state.users.find(u => u.id === act.userId);
                    return (
                      <div key={i} className="flex gap-3 relative pb-4 last:pb-0">
                        {i !== recentActivity.length - 1 && (
                          <div className="absolute left-[11px] top-7 bottom-0 w-[1px] bg-slate-100" />
                        )}
                        <div className="w-6 h-6 rounded-full border shadow-sm shrink-0 flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: user?.color }}>
                          {user?.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-900 leading-tight">
                            <span className="font-bold">{user?.name}</span> {act.action}
                          </p>
                          <p className="text-[10px] text-green-600 font-medium truncate mt-0.5">
                            {act.dealTitle}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                            {formatDistanceToNow(new Date(act.date), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
