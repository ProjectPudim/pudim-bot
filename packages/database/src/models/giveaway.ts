import mongoose, {
  type HydratedDocument,
  type InferSchemaType,
  type Types,
} from 'mongoose'

export const MAX_GIVEAWAY_WINNERS = 20

const resultSchema = new mongoose.Schema(
  {
    winners: {
      type: [String],
      default: [],
      validate: (ids: string[]) => new Set(ids).size === ids.length,
    },
    at: { type: Date, required: true },
    reroll: { type: Boolean, default: false },
  },
  { _id: false },
)

const giveawaySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    creatorId: { type: String, required: true },
    hostId: { type: String, required: true },
    prize: { type: String, required: true },
    title: { type: String, default: null },
    description: { type: String, default: null },
    color: { type: String, default: null },
    emoji: { type: String, required: true },
    image: { type: String, default: null },
    thumbnail: { type: String, default: null },
    winnerCount: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_GIVEAWAY_WINNERS,
      validate: Number.isInteger,
    },
    requiredRoleIds: { type: [String], default: [] },
    requiredJoinedDuration: { type: Number, default: null },
    requiredAccountAgeDuration: { type: Number, default: null },
    requiredServerId: { type: String, default: null },
    requiredServerInvite: { type: String, default: null },
    requiredServerInput: { type: String, default: null },
    serverResolved: { type: Boolean, default: false },
    ownedInviteCode: { type: String, default: null },
    ownedInviteVerified: { type: Boolean, default: false },
    inviteCreationStartedAt: { type: Date, default: null },
    inviteChannelId: { type: String, default: null },
    cleanupPending: { type: Boolean, default: false },
    endsAt: { type: Date, required: true },
    durationMs: { type: Number, default: null },
    status: {
      type: String,
      enum: ['creating', 'active', 'ending', 'ended', 'cancelled', 'rerolling'],
      default: 'active',
    },
    endedAt: { type: Date, default: null },
    entriesClosedAt: { type: Date, default: null },
    winners: {
      type: [String],
      default: [],
      validate: (ids: string[]) => new Set(ids).size === ids.length,
    },
    locale: { type: String, default: 'pt-BR' },
    history: { type: [resultSchema], default: [] },
    lockToken: { type: String, default: null },
    lockUntil: { type: Date, default: null },
    needsUpdate: { type: Boolean, default: false },
    reactionReady: { type: Boolean, default: false },
    revision: { type: Number, default: 0 },
    announcementPending: { type: Boolean, default: false },
    announcementId: { type: String, default: null },
    deliveryStartedAt: { type: Date, default: null },
    creatorNotifiedAt: { type: Date, default: null },
    publicationStartedAt: { type: Date, default: null },
    retryAt: { type: Date, default: null },
    lastReconciledAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
giveawaySchema.index({ guildId: 1, status: 1, endsAt: 1 })
giveawaySchema.index({ status: 1, endsAt: 1 })
giveawaySchema.index({ announcementPending: 1 })
giveawaySchema.index({ needsUpdate: 1 })
giveawaySchema.index({ cleanupPending: 1 })
giveawaySchema.index({ status: 1, lastReconciledAt: 1 })

const participantSchema = new mongoose.Schema(
  {
    giveawayId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    entered: { type: Boolean, default: true },
    pendingAction: {
      type: String,
      enum: ['add', 'remove', null],
      default: null,
    },
    pendingAt: { type: Date, default: null },
    generation: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)
participantSchema.index({ giveawayId: 1, userId: 1 }, { unique: true })
participantSchema.index({ pendingAction: 1, giveawayId: 1 })
participantSchema.index({ giveawayId: 1, entered: 1 })

export type GiveawayAttrs = InferSchemaType<typeof giveawaySchema>
export type GiveawayRecord = GiveawayAttrs & { _id: Types.ObjectId }
type ParticipantAttrs = InferSchemaType<typeof participantSchema>

export const Giveaway =
  (mongoose.models.Giveaway as mongoose.Model<GiveawayAttrs> | undefined) ??
  mongoose.model<GiveawayAttrs>('Giveaway', giveawaySchema)

export const GiveawayParticipant =
  (mongoose.models.GiveawayParticipant as
    mongoose.Model<ParticipantAttrs> | undefined) ??
  mongoose.model<ParticipantAttrs>('GiveawayParticipant', participantSchema)

export type GiveawayDocument = HydratedDocument<GiveawayAttrs>
export type GiveawayParticipantDocument = HydratedDocument<ParticipantAttrs>
