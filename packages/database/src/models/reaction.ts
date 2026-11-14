import mongoose, {
  Model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose'

const reactionSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, default: null },
    ownerId: { type: String, default: null },
    keys: { type: [String], default: [] },
    state: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
)

type ReactionAttrs = InferSchemaType<typeof reactionSchema>

export const Reaction: Model<ReactionAttrs> =
  (mongoose.models.Reaction as Model<ReactionAttrs> | undefined) ??
  mongoose.model<ReactionAttrs>('Reaction', reactionSchema)

export type ReactionDocument = HydratedDocument<ReactionAttrs>
