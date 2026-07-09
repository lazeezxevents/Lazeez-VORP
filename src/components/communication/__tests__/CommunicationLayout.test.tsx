import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommunicationLayout, CommunicationSidebarContainer, CommunicationContentContainer } from '../CommunicationLayout';

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    aside: ({ children, className, ...props }: any) => <aside className={className} {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('CommunicationLayout - Core Functionality', () => {
  const mockSidebar = (
    <CommunicationSidebarContainer>
      <div data-testid="sidebar-content">Sidebar Content</div>
    </CommunicationSidebarContainer>
  );

  const mockContent = (
    <CommunicationContentContainer>
      <div data-testid="main-content">Main Content</div>
    </CommunicationContentContainer>
  );

  describe('Basic Rendering', () => {
    it('should render sidebar and main content', () => {
      renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const sidebarElement = screen.getByTestId('sidebar-content');
      const mainElement = screen.getByTestId('main-content');
      
      expect(sidebarElement).toBeTruthy();
      expect(mainElement).toBeTruthy();
      expect(sidebarElement.textContent).toBe('Sidebar Content');
      expect(mainElement.textContent).toBe('Main Content');
    });

    it('should render mobile header with Communication title', () => {
      renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const title = screen.getByText('Communication');
      expect(title).toBeTruthy();
      expect(title.textContent).toBe('Communication');
    });

    it('should render hamburger menu button', () => {
      renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toBeTruthy();
    });
  });

  describe('Layout Structure - Requirements 22.4, 22.13', () => {
    it('should have proper layout classes for full screen height', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const layoutRoot = container.firstChild as HTMLElement;
      expect(layoutRoot.className).toContain('h-screen');
      expect(layoutRoot.className).toContain('flex');
      expect(layoutRoot.className).toContain('bg-background');
    });

    it('should have sidebar with proper width classes - Requirement 22.4', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar).toBeTruthy();
      expect(sidebar?.className).toContain('md:w-[320px]');
      expect(sidebar?.className).toContain('lg:w-[320px]');
    });

    it('should hide sidebar on mobile - Requirement 22.13', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('hidden');
      expect(sidebar?.className).toContain('md:flex');
    });

    it('should have main content area that is flexible', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const main = container.querySelector('main');
      expect(main).toBeTruthy();
      expect(main?.className).toContain('flex-1');
      expect(main?.className).toContain('flex-col');
    });
  });

  describe('Responsive Breakpoints - Requirements 27.2, 27.3', () => {
    it('should apply 768px breakpoint classes - Requirement 27.2', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('md:flex');
      expect(sidebar?.className).toContain('md:w-[320px]');
    });

    it('should apply 1024px breakpoint classes', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('lg:w-[320px]');
    });

    it('should have hamburger menu for mobile - Requirement 27.3', () => {
      renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toBeTruthy();
      expect(menuButton.getAttribute('aria-label')).toBe('Open navigation menu');
    });
  });

  describe('Dark Mode Support', () => {
    it('should use theme-aware CSS variables', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const layoutRoot = container.firstChild as HTMLElement;
      const sidebar = container.querySelector('aside');

      expect(layoutRoot.className).toContain('bg-background');
      expect(sidebar?.className).toContain('bg-background');
      expect(sidebar?.className).toContain('border-border');
    });
  });

  describe('Accessibility', () => {
    it('should use semantic HTML elements', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const aside = container.querySelector('aside');
      const main = container.querySelector('main');

      expect(aside).toBeTruthy();
      expect(main).toBeTruthy();
      expect(aside?.tagName).toBe('ASIDE');
      expect(main?.tagName).toBe('MAIN');
    });

    it('should have proper ARIA label for menu button', () => {
      renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton.getAttribute('aria-label')).toBe('Open navigation menu');
    });
  });

  describe('Container Components', () => {
    it('CommunicationSidebarContainer should render children', () => {
      renderWithRouter(
        <CommunicationSidebarContainer>
          <div data-testid="test-child">Test Content</div>
        </CommunicationSidebarContainer>
      );

      const child = screen.getByTestId('test-child');
      expect(child).toBeTruthy();
      expect(child.textContent).toBe('Test Content');
    });

    it('CommunicationSidebarContainer should have proper styling', () => {
      const { container } = renderWithRouter(
        <CommunicationSidebarContainer>
          <div>Content</div>
        </CommunicationSidebarContainer>
      );

      const sidebarContainer = container.firstChild as HTMLElement;
      expect(sidebarContainer.className).toContain('flex');
      expect(sidebarContainer.className).toContain('flex-col');
      expect(sidebarContainer.className).toContain('h-full');
      expect(sidebarContainer.className).toContain('bg-background');
    });

    it('CommunicationContentContainer should render children', () => {
      renderWithRouter(
        <CommunicationContentContainer>
          <div data-testid="content-child">Content</div>
        </CommunicationContentContainer>
      );

      const child = screen.getByTestId('content-child');
      expect(child).toBeTruthy();
      expect(child.textContent).toBe('Content');
    });

    it('CommunicationContentContainer should accept custom className', () => {
      const { container } = renderWithRouter(
        <CommunicationContentContainer className="custom-class">
          <div>Content</div>
        </CommunicationContentContainer>
      );

      const contentContainer = container.firstChild as HTMLElement;
      expect(contentContainer.className).toContain('custom-class');
      expect(contentContainer.className).toContain('flex');
      expect(contentContainer.className).toContain('flex-col');
      expect(contentContainer.className).toContain('h-full');
    });
  });

  describe('Requirements Validation Summary', () => {
    it('validates all core requirements are met', () => {
      const { container } = renderWithRouter(
        <CommunicationLayout sidebar={mockSidebar}>
          {mockContent}
        </CommunicationLayout>
      );

      // Requirement 22.4: Sidebar with department and channel list
      const sidebar = container.querySelector('aside');
      expect(sidebar).toBeTruthy();
      expect(screen.getByTestId('sidebar-content')).toBeTruthy();

      // Requirement 22.13: Responsive layout for mobile browsers
      expect(sidebar?.className).toContain('hidden'); // Hidden on mobile
      expect(sidebar?.className).toContain('md:flex'); // Visible on desktop
      expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeTruthy();

      // Requirement 27.2: Responsive breakpoints (640px, 768px, 1024px)
      expect(sidebar?.className).toContain('md:w-[320px]'); // 768px
      expect(sidebar?.className).toContain('lg:w-[320px]'); // 1024px

      // Requirement 27.3: Mobile drawer with hamburger menu
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toBeTruthy();

      // Dark mode support using next-themes
      expect(sidebar?.className).toContain('bg-background');
      expect(sidebar?.className).toContain('border-border');
    });
  });
});
