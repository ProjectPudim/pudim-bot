import mongoose, {
  Model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose'

const autoroleSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    all: { type: String, default: null },
    users: { type: String, default: null },
    apps: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
)

type AutoroleAttrs = InferSchemaType<typeof autoroleSchema>

export const Autorole: Model<AutoroleAttrs> =
  (mongoose.models.Autorole as Model<AutoroleAttrs> | undefined) ??
  mongoose.model<AutoroleAttrs>('Autorole', autoroleSchema)

export type AutoroleDocument = HydratedDocument<AutoroleAttrs>
