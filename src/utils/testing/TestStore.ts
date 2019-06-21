import Store, { StoreSettings } from '@orbit/store'
import { Dict } from '@orbit/utils'
import { ModelDefinition, Schema } from '@orbit/data'

const modelDefinition: Dict<ModelDefinition> = {
  account: {
    attributes: {
      test: { type: 'string' }
    },
    relationships: {
      profile: { type: 'hasOne', inverse: 'account', model: 'profile' },
      services: { type: 'hasMany', inverse: 'subscribers', model: 'service' }
    }
  },
  profile: {
    attributes: {
      test: { type: 'string' }
    },
    relationships: {
      account: { type: 'hasOne', inverse: 'profile', model: 'account' }
    }
  },
  service: {
    attributes: {
      test: { type: 'string' }
    },
    relationships: {
      subscribers: { type: 'hasMany', inverse: 'services', model: 'account' }
    }
  }
}

export class TestStore extends Store {
  constructor (settings?: StoreSettings) {
    super({ schema: new Schema({ models: modelDefinition }), ...settings })
  }
}
