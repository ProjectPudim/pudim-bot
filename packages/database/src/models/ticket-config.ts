import mongoose, {
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose'

export const TICKET_CLOSE_ACTIONS = ['delete', 'archive'] as const
export type TicketCloseAction = (typeof TICKET_CLOSE_ACTIONS)[number]
export const DEFAULT_TICKET_NAME_PATTERN = 'ticket-{ticket.count}'

export interface TicketOption {
  id: string
  emoji: string
  name: string
}

export interface TicketStoredEmbed {
  title?: string
  description: string | null
  color?: number
  timestamp?: true
  image?: { url: string }
  thumbnail?: { url: string }
  footer?: { text: string; icon_url?: string }
  author?: { name: string; icon_url?: string; url?: string }
}

export type TicketPanelEmbed = TicketStoredEmbed | null
export type TicketWelcomeEmbed = TicketStoredEmbed | null

const ticketConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, default: null },
    openCategoryId: { type: String, default: null },
    closedCategoryId: { type: String, default: null },
    panel: {
      embed: { type: mongoose.Schema.Types.Mixed, default: null },
      channelId: { type: String, default: null },
      messageId: { type: String, default: null },
    },
    options: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },
          emoji: { type: String, required: true },
          name: { type: String, required: true, trim: true, maxlength: 40 },
        },
      ],
      default: [],
    },
    close: {
      action: { type: String, enum: TICKET_CLOSE_ACTIONS, default: 'archive' },
      delay: { type: Number, default: 5, min: 0, max: 30 },
      emoji: { type: String, default: '❌' },
      openerCanClose: { type: Boolean, default: true },
      dm: { type: Boolean, default: true },
    },
    staffRoleIds: { type: [String], default: [] },
    logChannelId: { type: String, default: null },
    namePattern: {
      type: String,
      default: DEFAULT_TICKET_NAME_PATTERN,
      maxlength: 100,
    },
    counter: { type: Number, default: 0 },
    blacklist: { type: [String], default: [] },
    welcome: { embed: { type: mongoose.Schema.Types.Mixed, default: null } },
  },
  { timestamps: true, versionKey: false },
)

type SchemaAttrs = InferSchemaType<typeof ticketConfigSchema>
type PanelAttrs = NonNullable<SchemaAttrs['panel']>

export type TicketConfigAttrs = Omit<
  SchemaAttrs,
  'panel' | 'options' | 'welcome'
> & {
  panel?: Omit<PanelAttrs, 'embed'> & { embed?: TicketPanelEmbed }
  options: TicketOption[]
  welcome?: { embed?: TicketWelcomeEmbed }
}

export const TicketConfig: Model<TicketConfigAttrs> =
  (mongoose.models.TicketConfig as Model<TicketConfigAttrs> | undefined) ??
  mongoose.model<TicketConfigAttrs>('TicketConfig', ticketConfigSchema)

export type TicketConfigDocument = HydratedDocument<TicketConfigAttrs>
