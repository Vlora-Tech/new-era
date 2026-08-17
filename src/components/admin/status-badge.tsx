import type { ComponentProps } from 'react';
import type { $Enums } from '@prisma/client';

import { Badge } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

/**
 * State pills for the administration screens.
 *
 * Colour is a second channel and never the only one: every badge below renders
 * its Arabic label, so the state survives greyscale, a low-contrast display and
 * colour-blindness. That is the rule the `Badge` comment in `surface.tsx` states,
 * and it is why there is no variant here that renders an icon alone.
 *
 * Each map is `Record<$Enums.X, BadgeVariant>` rather than a lookup with a
 * fallback. Adding a member to an enum in `schema.prisma` then fails the type
 * check here, instead of shipping a pill that silently renders `undefined` or an
 * untranslated English identifier.
 */
type BadgeVariant = ComponentProps<typeof Badge>['variant'];

/**
 * A draft is neutral rather than a warning: it is the ordinary starting state of
 * every product, not a problem. Archived uses the outline variant so it reads as
 * withdrawn rather than as a live status with a colour of its own.
 */
export const PRODUCT_STATUS_VARIANTS: Record<$Enums.ProductStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  ARCHIVED: 'outline',
};

/**
 * `IN_REVIEW` is the only warning in the workflow — it is the state that is
 * waiting on a person. `APPROVED` is brand rather than success because the
 * question still is not reachable by any student; only `PUBLISHED` is.
 */
export const QUESTION_WORKFLOW_VARIANTS: Record<$Enums.QuestionWorkflow, BadgeVariant> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  APPROVED: 'brand',
  PUBLISHED: 'success',
  RETIRED: 'outline',
};

/**
 * Matches the map in the student area's record lists, so an order carries the
 * same colour in both places. It is restated rather than imported: the
 * administration area has no business depending on a module built for the
 * student dashboard, and a shared import would make the two move together for no
 * reason beyond having once agreed.
 */
export const ORDER_STATUS_VARIANTS: Record<$Enums.OrderStatus, BadgeVariant> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  FAILED: 'error',
  REFUNDED: 'neutral',
  CANCELLED: 'neutral',
};

export function ProductStatusBadge({ status }: { status: $Enums.ProductStatus }) {
  return (
    <Badge variant={PRODUCT_STATUS_VARIANTS[status]}>
      {COPY.adminProducts.statusLabels[status]}
    </Badge>
  );
}

export function QuestionWorkflowBadge({ workflow }: { workflow: $Enums.QuestionWorkflow }) {
  return (
    <Badge variant={QUESTION_WORKFLOW_VARIANTS[workflow]}>
      {COPY.adminQuestions.workflowLabels[workflow]}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: $Enums.OrderStatus }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANTS[status]}>{COPY.statusLabels.orderStatus[status]}</Badge>
  );
}

/**
 * A product's type is a taxonomy label, not a live state, so it takes the square
 * shape. Keeping the two apart is what stops every label in the interface
 * acquiring pill styling — see the `shape` variant comment in `surface.tsx`.
 */
export function ProductTypeBadge({ type }: { type: $Enums.ProductType }) {
  return (
    <Badge variant="outline" shape="square">
      {COPY.adminProducts.typeLabels[type]}
    </Badge>
  );
}
