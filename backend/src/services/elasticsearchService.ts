import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env';

export interface EmailDocument {
  id: string;
  jobId?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

class ElasticsearchService {
  private client: Client;
  private isAvailable: boolean = false;
  private hasChecked: boolean = false;

  constructor() {
    this.client = new Client({
      node: config.elasticsearch.node,
    });
  }

  public async init(): Promise<void> {
    if (this.hasChecked) return;
    this.hasChecked = true;

    try {
      const ping = await this.client.ping();
      this.isAvailable = ping;
      if (this.isAvailable) {
        console.log(`[Elasticsearch] Connected to node ${config.elasticsearch.node}`);
        await this.ensureIndex();
      }
    } catch (err: any) {
      this.isAvailable = false;
      console.warn(`[Elasticsearch] Cluster not reachable at ${config.elasticsearch.node}. Full-text search fallback to database enabled.`);
    }
  }

  private async ensureIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: config.elasticsearch.index });
      if (!exists) {
        await this.client.indices.create({
          index: config.elasticsearch.index,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                jobId: { type: 'keyword' },
                sender: { type: 'keyword' },
                recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        console.log(`[Elasticsearch] Index '${config.elasticsearch.index}' created.`);
      }
    } catch (err: any) {
      console.error('[Elasticsearch] Failed to create index:', err.message);
    }
  }

  public async indexEmail(doc: EmailDocument): Promise<void> {
    await this.init();
    if (!this.isAvailable) return;

    try {
      await this.client.index({
        index: config.elasticsearch.index,
        id: doc.id,
        body: doc,
      });
      await this.client.indices.refresh({ index: config.elasticsearch.index });
    } catch (err: any) {
      console.warn(`[Elasticsearch] Indexing failed for email ${doc.id}:`, err.message);
    }
  }

  public async searchEmails(query: string): Promise<string[] | null> {
    await this.init();
    if (!this.isAvailable) return null;

    try {
      const response = await this.client.search({
        index: config.elasticsearch.index,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['recipient^3', 'subject^2', 'body', 'sender', 'status'],
              fuzziness: 'AUTO',
            },
          },
        },
      });

      const hits = response.hits.hits;
      return hits.map((hit: any) => hit._id as string);
    } catch (err: any) {
      console.warn('[Elasticsearch] Search query failed, falling back to database:', err.message);
      return null;
    }
  }
}

export const elasticsearchService = new ElasticsearchService();
