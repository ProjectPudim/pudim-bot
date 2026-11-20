import mongoose, {
  Model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose'

const autoReactionSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    reaction: { type: String, required: true },
    type: {
      type: String,
      enum: ['all', 'text', 'image', 'video', 'media', 'link'],
      required: true,
    },
    ignore: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false, versionKey: false },
)

autoReactionSchema.index(
  { guildId: 1, channelId: 1, reaction: 1, type: 1 },
  { unique: true },
)
autoReactionSchema.index({ guildId: 1, channelId: 1 })

type AutoReactionAttrs = InferSchemaType<typeof autoReactionSchema>

export const AutoReaction: Model<AutoReactionAttrs> =
  (mongoose.models.AutoReaction as Model<AutoReactionAttrs> | undefined) ??
  mongoose.model<AutoReactionAttrs>('AutoReaction', autoReactionSchema)

export type AutoReactionDocument = HydratedDocument<AutoReactionAttrs>
export type AutoReactionType =
  'all' | 'text' | 'image' | 'video' | 'media' | 'link'
export const MAX_AUTO_REACTIONS = 25
