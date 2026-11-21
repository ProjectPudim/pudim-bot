import mongoose, {
  Model,
  type HydratedDocument,
  type InferSchemaType,
  type Types,
} from 'mongoose'

export const TICKET_STATUSES = ['open', 'closed'] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

const ticketSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    number: { type: Number, required: true },
    openerId: { type: String, required: true },
    optionId: { type: String, default: null },
    optionName: { type: String, default: null },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: 'open',
    },
    welcomeMessageId: { type: String, default: null },
    assigneeId: { type: String, default: null },
    addedUserIds: { type: [String], default: [] },
    closedById: { type: String, default: null },
    closedAt: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

ticketSchema.index({ guildId: 1, number: 1 }, { unique: true })
ticketSchema.index({ guildId: 1, openerId: 1, status: 1 })

export type TicketAttrs = InferSchemaType<typeof ticketSchema>

export type TicketRecord = TicketAttrs & { _id: Types.ObjectId }

export const Ticket: Model<TicketAttrs> =
  (mongoose.models.Ticket as Model<TicketAttrs> | undefined) ??
  mongoose.model<TicketAttrs>('Ticket', ticketSchema)

export type TicketDocument = HydratedDocument<TicketAttrs>
