import React from 'react';
import { Link } from 'react-router-dom';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

/**
 * One collapsible category in the admin sidebar. Built on the project's
 * existing Radix accordion primitive (see components/ui/accordion.jsx) so
 * the trigger is a real <button> with aria-expanded/aria-controls wired up
 * automatically, Enter/Space toggle it, and collapsed content is removed
 * from the DOM (not just visually hidden) so it can't be tab-focused.
 */
export default function CollapsibleNavGroup({ group, isActive, onLinkClick }) {
  return (
    <AccordionPrimitive.Item value={group.id} className="border-none">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger
          className="flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-muted-foreground text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-180"
        >
          {group.label}
          <ChevronDown size={13} className="shrink-0 transition-transform duration-200" aria-hidden="true" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="pt-0.5 pb-1 space-y-0.5">
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onLinkClick}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  active ? 'bg-primary text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
