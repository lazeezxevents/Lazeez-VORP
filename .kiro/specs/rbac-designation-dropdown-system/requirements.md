# Requirements Document

## Introduction

This specification addresses the inconsistent designation input methods across the Lazeez VORP system. Currently, the EmployeeDirectory component uses raw text inputs for designations while ProfileSettings and UserApprovals correctly implement RBAC dropdown selection from the custom_roles table. This creates system inconsistency and prevents proper role-based access control integration.

The feature will standardize all designation inputs to use proper RBAC dropdown selection, ensuring consistent user experience and proper integration with the centralized role management system.

## Glossary

- **RBAC_System**: Role-Based Access Control system managing custom roles and permissions
- **Designation_Dropdown**: Select component that fetches and displays available designations from custom_roles table
- **EmployeeDirectory**: HR component for managing employee profiles and assignments
- **ProfileSettings**: User settings component for personal profile management
- **UserApprovals**: Admin component for approving new user registrations
- **Custom_Roles_Table**: Database table storing all available designations with RBAC permissions
- **Raw_Text_Input**: Current problematic text input fields for designation entry
- **Designation_ID**: Foreign key reference to custom_roles table instead of free text

## Requirements

### Requirement 1: Replace Raw Text Designation Inputs

**User Story:** As an HR manager, I want all designation inputs to use standardized dropdown selection, so that designation assignments are consistent across the system.

#### Acceptance Criteria

1. THE EmployeeDirectory SHALL replace all raw text designation inputs with RBAC dropdown components
2. WHEN adding a new employee, THE EmployeeDirectory SHALL display a Select dropdown populated from custom_roles table
3. WHEN editing an employee, THE EmployeeDirectory SHALL display a Select dropdown with current designation pre-selected
4. THE EmployeeDirectory SHALL store designation_id foreign key references instead of free text
5. IF no custom roles exist in the database, THEN THE EmployeeDirectory SHALL display an empty dropdown with placeholder text

### Requirement 2: Maintain Existing RBAC Integration

**User Story:** As a system administrator, I want the existing RBAC dropdown implementations to remain functional, so that the system maintains consistency.

#### Acceptance Criteria

1. THE ProfileSettings SHALL continue using the existing useDesignations() hook implementation
2. THE UserApprovals SHALL continue using the existing customRoles query implementation  
3. THE ProfileSettings SHALL maintain the existing designation_id field mapping
4. THE UserApprovals SHALL maintain the existing RBAC dropdown functionality for user approval workflow
5. ALL components SHALL use the same data source (custom_roles table) for designation options

### Requirement 3: Implement Consistent Data Fetching

**User Story:** As a developer, I want all components to use the same data fetching pattern for designations, so that the codebase is maintainable and consistent.

#### Acceptance Criteria

1. THE EmployeeDirectory SHALL use the existing useDesignations() hook from useUsers.ts
2. WHEN the useDesignations hook is called, THE System SHALL fetch data from the designations table
3. THE EmployeeDirectory SHALL handle loading states during designation data fetching
4. THE EmployeeDirectory SHALL handle error states when designation data fails to load
5. THE EmployeeDirectory SHALL display designation options in alphabetical order by name

### Requirement 4: Preserve User Experience and Design Standards

**User Story:** As a user, I want the new dropdown components to follow the existing design system, so that the interface remains consistent and professional.

#### Acceptance Criteria

1. THE Designation_Dropdown SHALL use shadcn/ui Select components with consistent styling
2. THE Designation_Dropdown SHALL follow the design system typography standards (no ALL CAPS)
3. THE Designation_Dropdown SHALL include proper hover and focus states
4. THE Designation_Dropdown SHALL use consistent border radius (rounded-xl) and height (h-11)
5. THE Designation_Dropdown SHALL display placeholder text "Select designation" when no value is selected
6. THE Designation_Dropdown SHALL use consistent label styling with uppercase tracking and muted foreground color

### Requirement 5: Handle Data Migration and Validation

**User Story:** As a system administrator, I want existing text-based designation data to be properly handled during the transition, so that no data is lost.

#### Acceptance Criteria

1. THE System SHALL continue to display existing text-based designations in read-only contexts
2. WHEN editing an employee with text-based designation, THE System SHALL show the dropdown without pre-selection
3. THE System SHALL validate that selected designation_id exists in custom_roles table before saving
4. THE System SHALL handle cases where designation_id references deleted custom roles gracefully
5. THE System SHALL provide clear error messages when designation selection fails validation

### Requirement 6: Maintain Permission-Based Access Control

**User Story:** As an employee, I want designation editing permissions to be properly enforced, so that only authorized users can modify role assignments.

#### Acceptance Criteria

1. THE EmployeeDirectory SHALL enforce existing permission checks for designation editing
2. WHEN a user lacks designation editing permissions, THE Designation_Dropdown SHALL be disabled
3. THE System SHALL display appropriate permission messages when dropdowns are disabled
4. THE ProfileSettings SHALL maintain existing canEditDepartment permission logic for designations
5. THE System SHALL log all designation changes in the audit trail

### Requirement 7: Implement Proper Error Handling and Loading States

**User Story:** As a user, I want clear feedback when designation data is loading or fails to load, so that I understand the system state.

#### Acceptance Criteria

1. WHEN designation data is loading, THE Designation_Dropdown SHALL display a loading indicator
2. WHEN designation data fails to load, THE System SHALL display an error message with retry option
3. THE Designation_Dropdown SHALL handle network timeouts gracefully
4. WHEN no designations are available, THE System SHALL display "No designations available" message
5. THE System SHALL provide toast notifications for successful designation updates

### Requirement 8: Ensure Database Consistency and Referential Integrity

**User Story:** As a database administrator, I want designation references to maintain proper foreign key relationships, so that data integrity is preserved.

#### Acceptance Criteria

1. THE System SHALL store designation_id as UUID foreign key to custom_roles.id
2. THE System SHALL handle cascade operations when custom roles are deleted
3. THE System SHALL validate designation_id exists before allowing employee updates
4. THE System SHALL maintain backward compatibility with existing designation text fields
5. THE System SHALL provide migration path for converting text designations to ID references

### Requirement 9: Support Empty State and Default Behavior

**User Story:** As an HR manager, I want clear guidance when no designations are configured, so that I can properly set up the system.

#### Acceptance Criteria

1. WHEN no custom roles exist, THE Designation_Dropdown SHALL display "No designations available"
2. THE System SHALL provide guidance on how to create custom roles when none exist
3. THE Designation_Dropdown SHALL allow clearing designation selection (set to null)
4. THE System SHALL handle null designation_id values gracefully in all contexts
5. THE System SHALL provide default designation assignment workflows for new employees

### Requirement 10: Maintain Performance and Caching

**User Story:** As a user, I want designation dropdowns to load quickly and efficiently, so that the interface remains responsive.

#### Acceptance Criteria

1. THE useDesignations hook SHALL implement proper TanStack Query caching
2. THE System SHALL cache designation data across component instances
3. THE System SHALL invalidate designation cache when custom roles are modified
4. THE Designation_Dropdown SHALL debounce search/filter operations if implemented
5. THE System SHALL minimize database queries through efficient data fetching patterns
