import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

interface FormulaFunction {
  name: string;
  description: string;
  syntax: string;
  category: 'math' | 'statistical' | 'financial' | 'logical' | 'text' | 'date';
}

const FORMULA_FUNCTIONS: FormulaFunction[] = [
  // Math functions
  { name: 'SUM', description: 'Adds all numbers in a range', syntax: 'SUM(number1, [number2], ...)', category: 'math' },
  { name: 'AVERAGE', description: 'Returns the average of numbers', syntax: 'AVERAGE(number1, [number2], ...)', category: 'statistical' },
  { name: 'COUNT', description: 'Counts the number of cells that contain numbers', syntax: 'COUNT(value1, [value2], ...)', category: 'statistical' },
  { name: 'MIN', description: 'Returns the minimum value', syntax: 'MIN(number1, [number2], ...)', category: 'statistical' },
  { name: 'MAX', description: 'Returns the maximum value', syntax: 'MAX(number1, [number2], ...)', category: 'statistical' },
  
  // Logical functions
  { name: 'IF', description: 'Returns one value if condition is true, another if false', syntax: 'IF(condition, value_if_true, value_if_false)', category: 'logical' },
  { name: 'AND', description: 'Returns TRUE if all arguments are TRUE', syntax: 'AND(logical1, [logical2], ...)', category: 'logical' },
  { name: 'OR', description: 'Returns TRUE if any argument is TRUE', syntax: 'OR(logical1, [logical2], ...)', category: 'logical' },
  
  // Financial functions
  { name: 'NPV', description: 'Calculates net present value', syntax: 'NPV(rate, value1, [value2], ...)', category: 'financial' },
  { name: 'IRR', description: 'Calculates internal rate of return', syntax: 'IRR(values, [guess])', category: 'financial' },
  { name: 'PMT', description: 'Calculates payment for a loan', syntax: 'PMT(rate, nper, pv, [fv], [type])', category: 'financial' },
];

interface FormulaAutocompleteProps {
  input: string;
  onSelect: (formula: string) => void;
  position: { top: number; left: number };
}

export function FormulaAutocomplete({ input, onSelect, position }: FormulaAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<FormulaFunction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Extract the function name being typed
    const match = input.match(/=([A-Z]*)$/);
    if (match) {
      const partial = match[1];
      const filtered = FORMULA_FUNCTIONS.filter(f => 
        f.name.startsWith(partial)
      );
      setSuggestions(filtered);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [input]);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          onSelect(suggestions[selectedIndex].name);
        }
        break;
      case 'Escape':
        setSuggestions([]);
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex]);

  if (suggestions.length === 0) return null;

  const categoryColors = {
    math: 'text-blue-500',
    statistical: 'text-green-500',
    financial: 'text-purple-500',
    logical: 'text-orange-500',
    text: 'text-pink-500',
    date: 'text-cyan-500',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50 w-96 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-2 border-b border-border bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground">Formula suggestions</p>
        </div>
        
        <div ref={listRef} className="max-h-64 overflow-y-auto">
          {suggestions.map((func, index) => (
            <motion.div
              key={func.name}
              className={`
                px-3 py-2 cursor-pointer transition-colors
                ${index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'}
              `}
              onClick={() => onSelect(func.name)}
              whileHover={{ backgroundColor: 'hsl(var(--accent))' }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{func.name}</span>
                    <span className={`text-xs ${categoryColors[func.category]}`}>
                      {func.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {func.description}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-1 bg-muted/50 px-2 py-1 rounded">
                    {func.syntax}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-2 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground">
            Use ↑↓ to navigate, Enter to select, Esc to close
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
