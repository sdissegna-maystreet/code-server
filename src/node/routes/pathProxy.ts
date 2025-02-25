import { Request, Response } from "express"
import * as path from "path"
import qs from "qs"
import * as pluginapi from "../../../typings/pluginapi"
import { HttpCode, HttpError } from "../../common/http"
import { normalize } from "../../common/util"
import { authenticated, ensureAuthenticated, redirect } from "../http"
import { proxy as _proxy } from "../proxy"

const getProxyTarget = (req: Request, passthroughPath?: boolean): string => {
  if (passthroughPath) {
    return `http://0.0.0.0:${req.params.port}/${req.originalUrl}`
  }
  const query = qs.stringify(req.query)
  return `http://0.0.0.0:${req.params.port}/${req.params[0] || ""}${query ? `?${query}` : ""}`
}

export function proxy(
  req: Request,
  res: Response,
  opts?: {
    passthroughPath?: boolean
  },
): void {
  if (!authenticated(req, res)) {
    // If visiting the root (/:port only) redirect to the login page.
    if (!req.params[0] || req.params[0] === "/") {
      const to = normalize(`${req.baseUrl}${req.path}`)
      return redirect(req, res, "login", {
        to: to !== "/" ? to : undefined,
      })
    }
    throw new HttpError("Unauthorized", HttpCode.Unauthorized)
  }

  if (!opts?.passthroughPath) {
    // Absolute redirects need to be based on the subpath when rewriting.
    // See proxy.ts.
    ;(req as any).base = req.path.split(path.sep).slice(0, 3).join(path.sep)
  }

  _proxy.web(req, res, {
    ignorePath: true,
    target: getProxyTarget(req, opts?.passthroughPath),
  })
}

export async function wsProxy(
  req: pluginapi.WebsocketRequest,
  res: Response,
  opts?: {
    passthroughPath?: boolean
  },
): Promise<void> {
  await ensureAuthenticated(req, res)
  _proxy.ws(req, req.ws, req.head, {
    ignorePath: true,
    target: getProxyTarget(req, opts?.passthroughPath),
  })
}
