# Design System & UI/UX Guidelines

## Design Philosophy

### Core Principles
- **Modern & Professional**: Clean, premium aesthetic with subtle sophistication
- **Micro-interactions**: Every interaction should feel responsive and alive
- **Animation-first**: Use Framer Motion for smooth, purposeful animations
- **Accessibility**: Maintain WCAG standards while enhancing visual appeal
- **Consistency**: Reuse patterns across similar components

## Typography Standards

### Capitalization Rules
- **NEVER use ALL CAPS** for headers, labels, or content
- Use **sentence case** for most UI text (e.g., "Add new vendor")
- Use **title case** for page titles and major headings (e.g., "Vendor Management")
- Use **proper nouns** with correct capitalization (e.g., "Lazeez VORP", not "LAZEEZ VORP")

### Font Hierarchy
```
Page Titles:      font-bold text-2xl (Montserrat)
Section Headers:  font-semibold text-lg (Poppins)
Card Titles:      font-medium text-base (Poppins)
Body Text:        font-normal text-sm (Poppins)
Labels:           font-medium text-sm text-muted-foreground
Captions:         font-normal text-xs text-muted-foreground
```

## Animation Patterns

### Framer Motion Integration
Always use Framer Motion for animations, not CSS transitions alone.

#### Staggered Entry Pattern
```tsx
import { motion } from "framer-motion";

// Container with stagger children
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    visible: {
      transition: {
        staggerChildren: 0.05
      }
    }
  }}
>
  {items.map((item, i) => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {/* Content */}
    </motion.div>
  ))}
</motion.div>
```

#### Hover Scale Pattern
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.2 }}
>
  Quick action
</motion.button>
```

#### Icon Animation Pattern
```tsx
<motion.div
  whileHover={{ rotate: 5, scale: 1.1 }}
  transition={{ type: "spring", stiffness: 300 }}
>
  <Icon className="w-5 h-5" />
</motion.div>
```

### Standard Animation Timings
- **Micro-interactions**: 150-200ms (hover, tap)
- **Entry animations**: 300-400ms (fade-in, slide-in)
- **Stagger delay**: 50-80ms between items
- **Page transitions**: 400-500ms
- **Loading states**: 1500-2000ms (shimmer, pulse)

## Component Patterns

### Search Bar Pattern
The global search demonstrates key patterns to follow:

#### Multi-category Search
```tsx
// Group results by category
const categories = [
  { title: "Quick actions", items: quickActions },
  { title: "Vendors", items: filteredVendors },
  { title: "Issues", items: filteredIssues },
  { title: "Agreements", items: filteredMOUs }
];

// Render with staggered animation
{categories.map((category) => (
  category.items.length > 0 && (
    <motion.div key={category.title}>
      <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
        {category.title}
      </div>
      {category.items.map((item) => (
        <motion.div
          variants={itemVariants}
          whileHover={{ backgroundColor: "hsl(var(--accent))" }}
        >
          {/* Item content */}
        </motion.div>
      ))}
    </motion.div>
  )
))}
```

#### Status Badges
```tsx
// Priority with color coding
const priorityConfig = {
  low: { color: "bg-priority-low/10 text-priority-low", icon: AlertCircle },
  medium: { color: "bg-priority-medium/10 text-priority-medium", icon: AlertTriangle },
  high: { color: "bg-priority-high/10 text-priority-high", icon: AlertOctagon },
  critical: { color: "bg-priority-critical/10 text-priority-critical", icon: AlertTriangle }
};

<Badge className={priorityConfig[priority].color}>
  <Icon className="w-3 h-3 mr-1" />
  {priority}
</Badge>
```

### Quick Actions Pattern
Provide contextual shortcuts for common tasks:
- Position at top of search/command palettes
- Use clear, action-oriented labels
- Show only role-appropriate actions
- Include keyboard shortcuts where applicable

### Card Hover Effects
```tsx
<Card className="hover-lift transition-all duration-300 cursor-pointer group">
  <CardContent>
    {/* Icon with scale animation */}
    <div className="group-hover:scale-105 transition-transform">
      <Icon />
    </div>
  </CardContent>
</Card>
```

## Color Usage

### Status Colors
```css
Success:  hsl(var(--success))      /* Green - completed, approved */
Warning:  hsl(var(--warning))      /* Yellow - pending, in progress */
Info:     hsl(var(--info))         /* Blue - informational */
Error:    hsl(var(--destructive))  /* Red - failed, rejected */
```

### Priority Colors
```css
Low:      hsl(var(--priority-low))      /* Green */
Medium:   hsl(var(--priority-medium))   /* Yellow */
High:     hsl(var(--priority-high))     /* Orange */
Critical: hsl(var(--priority-critical)) /* Red */
```

### Semantic Usage
- Use `text-muted-foreground` for secondary text
- Use `text-foreground` for primary text
- Use `bg-accent` for hover states
- Use `border-border` for subtle dividers

## Interaction Patterns

### Click Interactions
1. **Immediate feedback**: Show pressed state (scale: 0.98)
2. **Loading state**: Show spinner or skeleton
3. **Success feedback**: Toast notification or visual confirmation
4. **Error handling**: Clear error message with recovery action

### Hover States
- **Cards**: Lift effect (translateY: -2px) + shadow increase
- **Buttons**: Slight scale (1.02) or background color shift
- **Icons**: Rotate or scale (1.1)
- **List items**: Background color change to accent

### Drag Interactions
- Use `@hello-pangea/dnd` for drag-and-drop
- Show drag handle on hover
- Provide visual feedback during drag (opacity, scale)
- Animate drop with spring physics

## Loading States

### Skeleton Pattern
```tsx
{isLoading ? (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-16 w-full" />
    ))}
  </div>
) : (
  // Actual content
)}
```

### Shimmer Effect
Use for inline loading (e.g., updating values):
```tsx
<div className="shimmer h-4 w-20 rounded" />
```

## Empty States

### Pattern
```tsx
<div className="text-center py-8 text-muted-foreground">
  <Icon className="w-10 h-10 mx-auto mb-3 opacity-50" />
  <p className="font-medium">No items found</p>
  <p className="text-sm">Try adjusting your search</p>
</div>
```

## Accessibility Requirements

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Provide visible focus indicators
- Support standard shortcuts (⌘K for search, Esc to close)
- Tab order should follow visual hierarchy

### Screen Readers
- Use semantic HTML (button, nav, main, aside)
- Provide aria-labels for icon-only buttons
- Announce dynamic content changes
- Use proper heading hierarchy

### Color Contrast
- Maintain WCAG AA standards (4.5:1 for normal text)
- Don't rely on color alone for information
- Provide text labels alongside color indicators

## Performance Considerations

### Animation Performance
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Use `will-change` sparingly
- Debounce search inputs (300ms)

### Image Optimization
- Use appropriate image formats (WebP with fallbacks)
- Lazy load images below the fold
- Provide loading placeholders

## Component Checklist

When creating new components, ensure:
- [ ] Follows typography standards (no ALL CAPS)
- [ ] Includes Framer Motion animations where appropriate
- [ ] Has proper hover/focus states
- [ ] Includes loading and empty states
- [ ] Is keyboard accessible
- [ ] Uses semantic color variables
- [ ] Follows naming conventions
- [ ] Has proper TypeScript types
- [ ] Includes error boundaries where needed
