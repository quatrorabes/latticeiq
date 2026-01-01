// frontend/src/components/ui/Tabs.tsx
// FINAL CORRECTED VERSION

import React from 'react';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

interface TabsListProps {
  children: React.ReactNode;
  activeTab?: string;
  onValueChange?: (v: string) => void;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  onValueChange?: (v: string) => void;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  className?: string;
}

const Tabs: React.FC<TabsProps> & {
  List: React.FC<TabsListProps>;
  Trigger: React.FC<TabsTriggerProps>;
  Content: React.FC<TabsContentProps>;
} = ({ value, onValueChange, children }) => {
  return (
    <div className="w-full">
      {React.Children.map(children, (child) =>
        React.cloneElement(child as React.ReactElement<any>, {
          activeTab: value,
          onValueChange,
        })
      )}
    </div>
  );
};

const TabsList: React.FC<TabsListProps> = ({ children }) => (
  <div className="flex border-b border-gray-200 gap-0">
    {children}
  </div>
);

const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  activeTab,
  onValueChange,
}) => (
  <button
    onClick={() => onValueChange?.(value)}
    className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
      activeTab === value
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  activeTab,
  className = 'py-6',
}) => {
  if (activeTab !== value) return null;
  return <div className={className}>{children}</div>;
};

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export { Tabs, TabsList, TabsTrigger, TabsContent };
