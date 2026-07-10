import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scenario } from '@/types/spreadsheet';
import { ModelingWorkspace } from '@/services/ModelingWorkspace';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ScenarioComparisonProps {
  workbookId: string;
}

export function ScenarioComparison({ workbookId }: ScenarioComparisonProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    variables: {} as Record<string, any>
  });

  useEffect(() => {
    loadScenarios();
  }, [workbookId]);

  const loadScenarios = async () => {
    // Load scenarios from database
    // This would be implemented with a proper query
    toast.info('Scenario loading coming soon');
  };

  const handleCreateScenario = async () => {
    if (!newScenario.name) {
      toast.error('Please enter a scenario name');
      return;
    }

    try {
      await ModelingWorkspace.createScenario(
        workbookId,
        newScenario.name,
        newScenario.description,
        newScenario.variables
      );
      
      toast.success('Scenario created');
      setIsCreating(false);
      setNewScenario({ name: '', description: '', variables: {} });
      loadScenarios();
    } catch (error) {
      toast.error('Failed to create scenario');
      console.error(error);
    }
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      } else if (prev.length < 3) {
        return [...prev, scenarioId];
      } else {
        toast.warning('Maximum 3 scenarios can be compared');
        return prev;
      }
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scenario analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compare different financial scenarios side-by-side
          </p>
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create scenario
              </Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new scenario</DialogTitle>
              <DialogDescription>
                Define variables and assumptions for this scenario
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Scenario name</Label>
                <Input
                  id="name"
                  value={newScenario.name}
                  onChange={(e) => setNewScenario(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Best case, Worst case"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newScenario.description}
                  onChange={(e) => setNewScenario(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the assumptions for this scenario"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateScenario}>
                  Create scenario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Scenario List */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {scenarios.length === 0 ? (
          <motion.div variants={itemVariants} className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium mb-2">No scenarios yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first scenario to start comparing different outcomes
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create scenario
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          scenarios.map((scenario) => {
            const isSelected = selectedScenarios.includes(scenario.id);
            
            return (
              <motion.div key={scenario.id} variants={itemVariants}>
                <Card
                  className={`
                    cursor-pointer transition-all duration-300
                    ${isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}
                  `}
                  onClick={() => toggleScenario(scenario.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{scenario.name}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                        >
                          <span className="text-xs text-primary-foreground font-bold">
                            ✓
                          </span>
                        </motion.div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {scenario.description || 'No description'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Comparison View */}
      {selectedScenarios.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Scenario comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {selectedScenarios.map((scenarioId) => {
                  const scenario = scenarios.find(s => s.id === scenarioId);
                  if (!scenario) return null;

                  return (
                    <div key={scenarioId} className="space-y-4">
                      <h3 className="font-semibold text-lg">{scenario.name}</h3>
                      
                      {/* Placeholder for comparison metrics */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">Revenue</span>
                          <span className="font-semibold">PKR 0</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">Expenses</span>
                          <span className="font-semibold">PKR 0</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">Net income</span>
                          <span className="font-semibold">PKR 0</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
