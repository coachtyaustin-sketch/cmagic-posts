import axios from "axios";

const GRAPH_API_VERSION = "v22.0"; // Ref: 2026 specs
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class InstagramGraphAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Translates the User's Facebook App scoped ID into a list of Pages they manage,
   * isolating the linked Instagram Professional Account ID.
   */
  async getLinkedInstagramAccounts() {
    try {
      // 1. Get the Facebook Pages managed by the User
      const pagesResponse = await axios.get(`${BASE_URL}/me/accounts`, {
        params: {
          access_token: this.accessToken,
          fields: "id,name,instagram_business_account{id,username,profile_picture_url,followers_count,follows_count,media_count}",
        },
      });

      const pages = pagesResponse.data.data;
      
      const igAccounts = pages
        .filter((page: any) => page.instagram_business_account)
        .map((page: any) => ({
          pageId: page.id,
          pageName: page.name,
          igAccountId: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          profilePic: page.instagram_business_account.profile_picture_url,
          followers: page.instagram_business_account.followers_count,
          follows: page.instagram_business_account.follows_count,
          mediaCount: page.instagram_business_account.media_count,
        }));

      return igAccounts;
    } catch (error: any) {
      console.error("Error fetching linked IG accounts:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Retrieves the latest media posts for a given Instagram Account ID.
   * Limits to 50 items per call as per rate limit optimization strategies.
   */
  async getRecentMedia(igAccountId: string, limit: number = 50) {
    try {
      const mediaResponse = await axios.get(`${BASE_URL}/${igAccountId}/media`, {
        params: {
          access_token: this.accessToken,
          fields: "id,caption,media_type,media_url,permalink,timestamp,thumbnail_url",
          limit: limit,
        },
      });

      return mediaResponse.data.data;
    } catch (error: any) {
      console.error("Error fetching media:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Retrieves advanced analytics (Reach, Saves, Shares, Views) for a specific Media ID.
   * Leverages the v22.0 unified 'views' metric and 'follow_type' breakdown for Reach.
   */
  async getMediaInsights(mediaId: string, mediaType: string) {
    try {
      // Standard metrics for all types
      let metric = "reach,saved,shares,views";

      let insightsResponse;
      try {
          // Attempt 1: Fetch with Follower/Non-Follower breakdown
          insightsResponse = await axios.get(`${BASE_URL}/${mediaId}/insights`, {
            params: {
              access_token: this.accessToken,
              metric: metric,
              metric_type: "total_value",
              breakdown: "follow_type",
            },
          });
      } catch (firstError: any) {
          // If the breakdown is incompatible (e.g. small accounts or certain reels), try without it
          if (firstError.response?.data?.error?.code === 100) {
              insightsResponse = await axios.get(`${BASE_URL}/${mediaId}/insights`, {
                params: {
                  access_token: this.accessToken,
                  metric: metric,
                  metric_type: "total_value"
                },
              });
          } else {
              throw firstError;
          }
      }

      const insights = insightsResponse.data.data;
      
      // Parse the results dynamically
      const result = {
        reach: { total: 0, follower: 0, nonFollower: 0 },
        saved: 0,
        shares: 0,
        views: 0
      };

      insights.forEach((insight: any) => {
        if (insight.name === "reach") {
           // Handle breakdown (Attempt 1 structure)
           if (insight.values && insight.values[0] && insight.values[0].value && typeof insight.values[0].value === 'object') {
              const breakdownData = insight.values[0].value;
              result.reach.total = (breakdownData.FOLLOWER || 0) + (breakdownData.NON_FOLLOWER || 0);
              result.reach.follower = breakdownData.FOLLOWER || 0;
              result.reach.nonFollower = breakdownData.NON_FOLLOWER || 0;
           } else if (insight.values && insight.values[0]) {
               // Handle standard flat total (Attempt 2 structure)
               result.reach.total = insight.values[0].value || 0;
           }
        } 
        else if (insight.name === "saved") {
           result.saved = insight.values[0]?.value || 0;
        }
        else if (insight.name === "shares") {
           result.shares = insight.values[0]?.value || 0;
        }
        else if (insight.name === "views") {
           result.views = insight.values[0]?.value || 0;
        }
      });

      return result;
    } catch (error: any) {
      console.error(`Error fetching insights for media ${mediaId}:`, error.response?.data || error.message);
      
      // Handle regional EU shielding gracefully by returning 0s
      return {
        reach: { total: 0, follower: 0, nonFollower: 0 },
        saved: 0,
        shares: 0,
        views: 0,
        error: error.response?.data?.error?.message || "Data Unavailable"
      };
    }
  }
}
