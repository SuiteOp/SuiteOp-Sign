import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { z } from 'zod';

export const ZGetEnvelopeItemsByTokenRequestSchema = z.object({
  envelopeId: z.string(),
  access: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('recipient'),
      token: z.string(),
    }),
    z.object({
      type: z.literal('user'),
    }),
  ]),
});

export const ZGetEnvelopeItemsByTokenResponseSchema = z.object({
  /**
   * The parent envelope (document) title. Used as the download filename for
   * single-item envelopes so it reflects the current document title rather than
   * the item title, which is set at creation and not updated when the document
   * is renamed.
   */
  title: z.string(),
  data: EnvelopeItemSchema.pick({
    id: true,
    envelopeId: true,
    title: true,
    order: true,
  }).array(),
});
