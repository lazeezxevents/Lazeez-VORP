/**
 * UI/UX Compliance Checker for Finance Module
 * Ensures all components follow design system standards
 */

interface ComplianceIssue {
  component: string;
  severity: 'error' | 'warning' | 'info';
  category: 'typography' | 'animation' | 'accessibility' | 'color' | 'interaction';
  message: string;
  fix?: string;
}

interface ComplianceReport {
  passed: boolean;
  score: number;
  issues: ComplianceIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export class UIComplianceChecker {
  private issues: ComplianceIssue[] = [];

  /**
   * Check typography compliance
   */
  checkTypography(component: string, element: HTMLElement): void {
    // Check for ALL CAPS text
    const text = element.textContent || '';
    if (text.length > 3 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
      this.issues.push({
        component,
        severity: 'error',
        category: 'typography',
        message: 'Text uses ALL CAPS which violates design system',
        fix: 'Use sentence case or title case instead'
      });
    }

    // Check font classes
    const classes = element.className;
    const hasValidFont = 
      classes.includes('font-bold') ||
      classes.includes('font-semibold') ||
      classes.includes('font-medium') ||
      classes.includes('font-normal');

    if (!hasValidFont && element.tagName !== 'BODY') {
      this.issues.push({
        component,
        severity: 'warning',
        category: 'typography',
        message: 'Element missing font weight class',
        fix: 'Add appropriate font-* class (font-bold, font-semibold, font-medium, font-normal)'
      });
    }
  }

  /**
   * Check animation compliance
   */
  checkAnimation(component: string, element: HTMLElement): void {
    const classes = element.className;
    
    // Check for CSS transitions instead of Framer Motion
    const style = window.getComputedStyle(element);
    if (style.transition && style.transition !== 'none' && !element.hasAttribute('data-framer-motion')) {
      this.issues.push({
        component,
        severity: 'warning',
        category: 'animation',
        message: 'Using CSS transitions instead of Framer Motion',
        fix: 'Replace with Framer Motion animations for consistency'
      });
    }

    // Check for hover effects on interactive elements
    const isInteractive = 
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.getAttribute('role') === 'button';

    if (isInteractive && !classes.includes('hover:')) {
      this.issues.push({
        component,
        severity: 'info',
        category: 'animation',
        message: 'Interactive element missing hover state',
        fix: 'Add hover effects (scale, color change, etc.)'
      });
    }
  }

  /**
   * Check accessibility compliance
   */
  checkAccessibility(component: string, element: HTMLElement): void {
    // Check for aria-labels on icon-only buttons
    if (element.tagName === 'BUTTON') {
      const hasText = element.textContent && element.textContent.trim().length > 0;
      const hasAriaLabel = element.hasAttribute('aria-label');
      const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');

      if (!hasText && !hasAriaLabel && !hasAriaLabelledBy) {
        this.issues.push({
          component,
          severity: 'error',
          category: 'accessibility',
          message: 'Button missing accessible label',
          fix: 'Add aria-label or visible text content'
        });
      }
    }

    // Check for keyboard accessibility
    const isInteractive = 
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.getAttribute('role') === 'button';

    if (isInteractive && element.tabIndex === -1) {
      this.issues.push({
        component,
        severity: 'error',
        category: 'accessibility',
        message: 'Interactive element not keyboard accessible',
        fix: 'Remove tabIndex={-1} or add keyboard event handlers'
      });
    }

    // Check for semantic HTML
    if (element.getAttribute('role') === 'button' && element.tagName !== 'BUTTON') {
      this.issues.push({
        component,
        severity: 'warning',
        category: 'accessibility',
        message: 'Using role="button" instead of semantic <button>',
        fix: 'Use <button> element for better accessibility'
      });
    }
  }

  /**
   * Check color usage compliance
   */
  checkColors(component: string, element: HTMLElement): void {
    const classes = element.className;

    // Check for hardcoded colors instead of CSS variables
    const style = window.getComputedStyle(element);
    const hasHardcodedColor = 
      (style.color && !style.color.includes('var(')) ||
      (style.backgroundColor && !style.backgroundColor.includes('var('));

    if (hasHardcodedColor) {
      this.issues.push({
        component,
        severity: 'warning',
        category: 'color',
        message: 'Using hardcoded colors instead of CSS variables',
        fix: 'Use semantic color classes (text-foreground, bg-accent, etc.)'
      });
    }

    // Check for proper status color usage
    const hasStatusClass = 
      classes.includes('text-success') ||
      classes.includes('text-warning') ||
      classes.includes('text-info') ||
      classes.includes('text-destructive');

    const hasStatusText = element.textContent?.toLowerCase().match(/success|warning|error|info/);

    if (hasStatusText && !hasStatusClass) {
      this.issues.push({
        component,
        severity: 'info',
        category: 'color',
        message: 'Status text without semantic color',
        fix: 'Add appropriate status color class'
      });
    }
  }

  /**
   * Check interaction patterns
   */
  checkInteractions(component: string, element: HTMLElement): void {
    const classes = element.className;

    // Check for loading states
    if (element.tagName === 'BUTTON') {
      const hasLoadingState = 
        classes.includes('disabled:') ||
        element.hasAttribute('disabled');

      if (!hasLoadingState) {
        this.issues.push({
          component,
          severity: 'info',
          category: 'interaction',
          message: 'Button missing loading/disabled state',
          fix: 'Add disabled state styling and loading indicator'
        });
      }
    }

    // Check for focus states
    const isInteractive = 
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.tagName === 'INPUT';

    if (isInteractive && !classes.includes('focus:')) {
      this.issues.push({
        component,
        severity: 'warning',
        category: 'interaction',
        message: 'Interactive element missing focus state',
        fix: 'Add focus: classes for keyboard navigation'
      });
    }
  }

  /**
   * Generate compliance report
   */
  generateReport(): ComplianceReport {
    const errors = this.issues.filter(i => i.severity === 'error').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const info = this.issues.filter(i => i.severity === 'info').length;

    const totalIssues = errors + warnings + info;
    const score = Math.max(0, 100 - (errors * 10 + warnings * 5 + info * 1));

    return {
      passed: errors === 0,
      score,
      issues: this.issues,
      summary: {
        errors,
        warnings,
        info
      }
    };
  }

  /**
   * Reset checker
   */
  reset(): void {
    this.issues = [];
  }
}

/**
 * Design System Compliance Guidelines
 */
export const DesignSystemGuidelines = {
  typography: {
    rules: [
      'Never use ALL CAPS for headers, labels, or content',
      'Use sentence case for most UI text',
      'Use title case for page titles and major headings',
      'Use proper nouns with correct capitalization'
    ],
    fontHierarchy: {
      pageTitle: 'font-bold text-2xl',
      sectionHeader: 'font-semibold text-lg',
      cardTitle: 'font-medium text-base',
      bodyText: 'font-normal text-sm',
      label: 'font-medium text-sm text-muted-foreground',
      caption: 'font-normal text-xs text-muted-foreground'
    }
  },
  
  animation: {
    rules: [
      'Always use Framer Motion for animations',
      'Use transform and opacity for GPU acceleration',
      'Avoid animating width, height, top, left',
      'Debounce search inputs (300ms)'
    ],
    timings: {
      microInteraction: '150-200ms',
      entryAnimation: '300-400ms',
      staggerDelay: '50-80ms',
      pageTransition: '400-500ms',
      loadingState: '1500-2000ms'
    }
  },
  
  colors: {
    status: {
      success: 'hsl(var(--success))',
      warning: 'hsl(var(--warning))',
      info: 'hsl(var(--info))',
      error: 'hsl(var(--destructive))'
    },
    semantic: {
      primary: 'text-foreground',
      secondary: 'text-muted-foreground',
      hover: 'bg-accent',
      border: 'border-border'
    }
  },
  
  accessibility: {
    rules: [
      'All interactive elements must be keyboard accessible',
      'Provide visible focus indicators',
      'Use semantic HTML',
      'Provide aria-labels for icon-only buttons',
      'Maintain WCAG AA color contrast (4.5:1)'
    ]
  },
  
  interactions: {
    click: [
      'Show pressed state (scale: 0.98)',
      'Show loading state with spinner',
      'Show success feedback with toast',
      'Show error message with recovery action'
    ],
    hover: [
      'Cards: lift effect + shadow increase',
      'Buttons: scale (1.02) or color shift',
      'Icons: rotate or scale (1.1)',
      'List items: background color to accent'
    ]
  }
};

/**
 * Component compliance checklist
 */
export const ComponentChecklist = [
  'Follows typography standards (no ALL CAPS)',
  'Includes Framer Motion animations where appropriate',
  'Has proper hover/focus states',
  'Includes loading and empty states',
  'Is keyboard accessible',
  'Uses semantic color variables',
  'Follows naming conventions',
  'Has proper TypeScript types',
  'Includes error boundaries where needed'
];
