import fs from 'fs';
import path from 'path';

const routes = {
  Public: [
    { path: '/', title: 'Home' },
    { path: '/pricing', title: 'Pricing' },
    { path: '/content-preview', title: 'Content Preview' },
    { path: '/about', title: 'About' },
    { path: '/support', title: 'Support' },
    { path: '/contact', title: 'Contact' },
    { path: '/terms', title: 'Terms of Service' },
    { path: '/privacy', title: 'Privacy Policy' },
  ],
  Auth: [
    { path: '/sign-up', title: 'Sign Up' },
    { path: '/login', title: 'Log In' },
    { path: '/forgot-password', title: 'Forgot Password' },
    { path: '/reset-password', title: 'Reset Password' },
    { path: '/verify-email', title: 'Verify Email' },
  ],
  Subscriber: [
    { path: '/library', title: 'My Library' },
    { path: '/library/[contentId]', title: 'View Content' },
    { path: '/locked-content', title: 'Locked Content' },
    { path: '/subscription', title: 'My Subscription' },
    { path: '/billing', title: 'Billing History' },
    { path: '/account', title: 'Account Settings' },
    { path: '/notifications', title: 'Notifications' },
  ],
  Creator: [
    { path: '/creator', title: 'Creator Dashboard' },
    { path: '/creator/content', title: 'Manage Content' },
    { path: '/creator/content/new', title: 'New Content' },
    { path: '/creator/content/[contentId]/edit', title: 'Edit Content' },
    { path: '/creator/subscribers', title: 'Subscribers' },
    { path: '/creator/plans', title: 'Subscription Plans' },
    { path: '/creator/revenue', title: 'Revenue' },
    { path: '/creator/analytics', title: 'Analytics' },
    { path: '/creator/settings', title: 'Creator Settings' },
  ],
  Admin: [
    { path: '/admin', title: 'Admin Dashboard' },
    { path: '/admin/users', title: 'Manage Users' },
    { path: '/admin/creators', title: 'Manage Creators' },
    { path: '/admin/subscribers', title: 'Manage Subscribers' },
    { path: '/admin/plans', title: 'Manage Plans' },
    { path: '/admin/content', title: 'Manage Content' },
    { path: '/admin/subscriptions', title: 'Manage Subscriptions' },
    { path: '/admin/payments', title: 'Payments & Payouts' },
    { path: '/admin/notifications', title: 'System Notifications' },
    { path: '/admin/analytics', title: 'Platform Analytics' },
    { path: '/admin/settings', title: 'Platform Settings' },
  ]
};

const BASE_DIR = path.join(process.cwd(), 'src', 'app');

function createPageContent(role, title) {
  return `import React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ${title.replace(/[^a-zA-Z0-9]/g, '')}Page() {
  return (
    <PageShell role="${role}" title="${title}">
      <div className="flex-1 flex items-center justify-center">
        <EmptyState 
          title="${title}" 
          description="This is a placeholder page for the ${role} portal. Content will be implemented in future iterations."
        />
      </div>
    </PageShell>
  );
}
`;
}

Object.entries(routes).forEach(([role, paths]) => {
  paths.forEach(({ path: routePath, title }) => {
    // Handle the root path '/' specially
    const fullDir = routePath === '/' ? BASE_DIR : path.join(BASE_DIR, routePath);
    
    // Create directory recursively
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    const filePath = path.join(fullDir, 'page.tsx');
    fs.writeFileSync(filePath, createPageContent(role, title));
    console.log(`Created: ${filePath}`);
  });
});

console.log('All placeholder routes generated successfully.');
